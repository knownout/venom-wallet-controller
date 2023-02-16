import BaseController from "@knownout/base-controller";
import BigNumber from "bignumber.js";
import { Address, FullContractState, ProviderRpcClient, Subscription } from "everscale-inpage-provider";
import { action, computed, makeObservable, observable } from "mobx";
import { VenomConnect } from "venom-connect";
import initVenomConnect from "./utils/init-venom-connect";
import { waitingVenomPromise } from "./utils/waiting-venom-promise";

export type TVenomWalletAccountData = {
    address: Address;
    contractType: string;
    publicKey: string;
}

/**
 * Provider instance, should not be overwritten.
 * @type {ProviderRpcClient}
 */
let globalRpcClient = new ProviderRpcClient({
    forceUseFallback: true,
    fallback: () => waitingVenomPromise()
});

interface IVenomWalletState {
    /** True only if the wallet is connected. */
    connected: boolean;

    /** True only on controller initialization or wallet change. */
    loading: boolean;

    /** Current wallet balance, updated in real time. */
    balance?: BigNumber;

    /** True only if wallet contract exist (deployed). */
    walletDeployed?: boolean;
}

interface IVenomWalletData {
    /** True if venom wallet is installed in the user browser. */
    walletInstalled?: boolean;

    /** Contains connected account information. */
    walletAccount?: TVenomWalletAccountData;

    /** Installed extension version. */
    walletVersion?: string;

    /** Saved wallet contract state. */
    walletContract?: FullContractState;

    /** Connected wallet provider instance. */
    walletProvider?: ProviderRpcClient;
}

export type TVenomWalletEvents = "walletConnected"
    | "walletDisconnected"
    | "contractStateChanged"
    | "controllerInitialized"

/**
 * Venom wallet controller based on venom-connect.
 */
class VenomWalletController extends BaseController<IVenomWalletState, IVenomWalletData> {

    @observable private venomConnect?: VenomConnect;

    @observable private networkID = 1000

    #standaloneClient: ProviderRpcClient | null = null;

    #walletContractSubscription?: Subscription<"contractStateChanged">;

    #walletPermissionsSubscription?: Subscription<"permissionsChanged">;

    #eventListeners: Partial<{ [key in TVenomWalletEvents]: Function[] }> = {};

    constructor () {
        super({ connected: false, loading: true }, {});
        makeObservable(this);

        this.updateWalletContract = this.updateWalletContract.bind(this);
        this.disconnectWallet = this.disconnectWallet.bind(this);
        this.addEventListener = this.addEventListener.bind(this);
        this.callEvent = this.callEvent.bind(this);
        this.removeEventListeners = this.removeEventListeners.bind(this);
        this.removeEventListener = this.removeEventListener.bind(this);
    }

    /**
     * Method for getting inpage provider.
     * @return {ProviderRpcClient | null} inpage provider instance or null if not initialized.
     */
    public get rpcClient () { return this.data.walletProvider ?? globalRpcClient; }

    /**
     * Method for getting standalone client
     * @return {ProviderRpcClient | null} standalone client instance or null if not initialized.
     */
    @computed
    public get standaloneClient () {
        if (!this.venomConnect) return null;

        return this.#standaloneClient;
    }

    /**
     * Initialization of providers and connector.
     * The method should be called once per application lifecycle.
     * @param {() => Promise<VenomConnect>} initFunction venom-connect custom initialization function.
     * @return {Promise<void>}
     */
    @action
    public async initController (initFunction?: () => Promise<VenomConnect>) {
        this.setState("loading", true);

        // Waiting for connector
        this.venomConnect = await (initFunction ?? initVenomConnect)(this.networkID);

        await new Promise(resolve => setTimeout(resolve, 100));
        const walletProvider = await this.venomConnect.checkAuth();

        // Check if browser extension is installed
        const walletInstalled = Boolean(walletProvider);

        this.setData({ walletInstalled });

        if (!walletInstalled) {
            this.setState("loading", false);

            this.callEvent("controllerInitialized");
            return;
        }

        this.setData({ walletProvider });

        // Get a standalone client instance
        this.#standaloneClient = await this.venomConnect.getStandalone();

        // Check if wallet is connected
        const walletAccount = await this.checkWalletAuthentication();

        const networkValid = await this.verifyWalletNetwork();

        // If connected, then update states
        if (walletAccount) {
            this.setData({ walletAccount });

            await this.createWalletSubscription();

            await this.updateWalletContract();
        }

        this.setState({ connected: Boolean(walletAccount) && networkValid, loading: false });

        if (this.state.connected && walletAccount) {
            this.callEvent("walletConnected", walletAccount.address.toString());
        }

        this.callEvent("controllerInitialized");
    }

    /**
     * Method for calling the relevant action to connect or disconnect the wallet.
     */
    @action
    public callWalletAction (forceDisconnect?: true) {
        // If wallet is connected, then disable it ...
        if (this.state.connected || forceDisconnect) return this.disconnectWallet();

        if (this.state.loading) return;

        // ... and vice versa
        if (!this.state.connected) this.connectWallet();
    }

    /**
     * Method for changing default network ID for verification
     */
    @action
    public changeDefaultNetworkID (networkID: number) {
        this.networkID = networkID
    }

    @action
    public async changeWalletAccount () {
        await this.rpcClient.changeAccount()

        const data = await this.rpcClient.getProviderState()

        if (!data.permissions.accountInteraction) {
            this.disconnectWallet()

            this.callEvent("walletDisconnected")
            return
        }

        this.setData({ walletAccount: data.permissions.accountInteraction })

        await this.updateWalletContract()
    }

    /**
     * Method for creating a subscription to change the wallet contract.
     *
     * Subscription to a contract change is needed primarily for
     * real-time wallet balance updates.
     *
     * When called again, kills previous subscriptions.
     *
     * @return {Promise<void>}
     * @protected
     */
    @action
    protected async createWalletSubscription () {
        if (!this.data.walletAccount || !this.standaloneClient) return;

        // Kill current subscription if exists
        if (this.#walletContractSubscription !== undefined) {
            await this.#walletContractSubscription.unsubscribe?.();
            this.#walletContractSubscription = undefined;
        }

        await new Promise(r => setTimeout(r, 100));

        this.#walletContractSubscription = await this.standaloneClient
            .subscribe("contractStateChanged", {
                address: this.data.walletAccount.address
            });

        this.#walletContractSubscription?.on("data", this.updateWalletContract);
    }

    /**
     * Method for updating states based on the wallet contract.
     *
     * Updates balance and other states.
     *
     * @return {Promise<void>}
     * @protected
     */
    @action
    protected async updateWalletContract () {
        if (!this.data.walletAccount || !this.standaloneClient) return;

        // Getting full state of the user wallet contract.
        const { state } = await this.standaloneClient.getFullContractState({
            address: this.data.walletAccount.address
        });

        // Update balance and save updated contract state.
        if (state?.balance) this.setState("balance", new BigNumber(state.balance).shiftedBy(-9));

        if (state === undefined) this.setState("walletDeployed", false);

        this.setData("walletContract", state);
        this.callEvent("contractStateChanged", state);
    }

    /**
     * Method for checking the connection of the wallet to this application.
     *
     * @return {Promise<boolean | TVenomWalletAccountData>} false if not connected, otherwise — account data.
     * @protected
     */
    protected async checkWalletAuthentication () {
        if (!this.venomConnect) return false;

        let providerState = await this.rpcClient.getProviderState();
        if (!providerState || !providerState.permissions.accountInteraction) {
            providerState = await globalRpcClient.getProviderState();

            if (!providerState || !providerState.permissions.accountInteraction) return false;
        }

        return providerState.permissions.accountInteraction as TVenomWalletAccountData;
    }

    /**
     * Method for calling wallet connection modal window.
     *
     * Creates or overwrites (if exists) a subscription to
     * changing wallet access rights.
     *
     * Calls the venom-connect modal window.
     *
     * @return {Promise<void>}
     * @protected
     */
    @action
    protected async connectWallet () {
        if (!("on" in (this.venomConnect ?? {}))) this.venomConnect = await initVenomConnect(this.networkID);

        this.resetState("loading");
        this.resetData("walletInstalled", "walletVersion", "walletProvider");

        globalRpcClient.disconnect?.();

        if (this.data.walletProvider) this.data.walletProvider.disconnect?.();

        if (!this.venomConnect) return;

        // Kill the current subscription (if it exists).
        if (this.#walletPermissionsSubscription) {
            await this.#walletPermissionsSubscription.unsubscribe();
            this.#walletPermissionsSubscription = undefined;
        }

        // Calling the venom-connect modal window.
        try {
            this.setData("walletProvider", await this.venomConnect.connect());
        } catch {
            this.venomConnect = await initVenomConnect(this.networkID);
            this.setData("walletProvider", await this.venomConnect.connect());
        }

        // Create a new subscription to permissions change.
        this.#walletPermissionsSubscription = await this.rpcClient.subscribe("permissionsChanged");

        this.#walletPermissionsSubscription.on("data", async data => {
            if (!data.permissions.accountInteraction) return;

            this.setState("loading", true);

            this.setData({
                walletAccount: data.permissions.accountInteraction,
                walletProvider: this.venomConnect?.currentProvider
            });

            await this.createWalletSubscription();
            await this.updateWalletContract();

            this.setState({ connected: Boolean(this.data.walletAccount), loading: false });

            if (this.state.connected) {
                this.callEvent("walletConnected", this.data.walletAccount?.address.toString());
            }

            this.#walletPermissionsSubscription?.unsubscribe?.();
            this.#walletPermissionsSubscription = undefined;
        });
    }

    /**
     * Method for disconnecting the wallet from the application and resetting the states.
     *
     * Installation status of the wallet and its version is not reset.
     *
     * @return {Promise<void>}
     * @protected
     */
    @action
    protected disconnectWallet () {
        if (!this.rpcClient || !this.venomConnect) return;

        try {
            globalRpcClient.disconnect?.();
            this.rpcClient.disconnect?.();
        } catch { }

        this.resetState("loading");
        this.resetData("walletInstalled", "walletVersion");

        this.callEvent("walletDisconnected");
    }

    /**
     * Method for checking if a connected wallet network has
     * networkId 1000 and is venom mainnet.
     *
     * @return {Promise<boolean>}
     * @protected
     */
    @observable
    protected async verifyWalletNetwork () {
        try {
            const providerState = await this.data.walletProvider?.getProviderState().catch(() => {
                throw new Error("Wallet provider state requiring error");
            });

            return !(!providerState
                || ("networkId" in providerState && providerState.networkId !== this.networkID));
        } catch { return false; }
    }

    /**
     * Method for adding a listener to the wallet connect event.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {Function} listener callback function.
     */
    public addEventListener (event: "walletConnected", listener: (address: string) => void): void;

    /**
     * Method for adding a listener to the wallet disconnect event.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {Function} listener callback function.
     */
    public addEventListener (event: "walletDisconnected", listener: () => void): void;

    /**
     * Method for adding a listener to the wallet contract state changed event.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {Function} listener callback function.
     */
    public addEventListener (event: "contractStateChanged", listener: (state?: FullContractState) => void): void;

    /**
     * Method for adding a listener to a specific event.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {Function} listener callback function.
     */
    @observable
    public addEventListener (event: TVenomWalletEvents, listener: Function) {
        if (!this.#eventListeners[event]) this.#eventListeners[event] = [];

        if (event === "walletConnected" && this.state.connected)
            this.callEvent("walletConnected", this.data.walletAccount?.address.toString());

        if (event === "controllerInitialized" && this.state.loading === false)
            this.callEvent("controllerInitialized");

        if (this.#eventListeners[event]?.find(fn => String(fn) === String(event))) return;

        this.#eventListeners[event]?.push(listener);
    }

    /**
     * Method for removing a specific listener for an event.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {Function} listener callback function.
     */
    @observable
    public removeEventListener (event: TVenomWalletEvents, listener: Function) {
        if (!this.#eventListeners[event]) return;

        this.#eventListeners[event] = this.#eventListeners[event]?.filter(fn => String(fn) !== String(listener));
    }

    /**
     * Method for removing all listeners from a specific event, or all listeners if the event name is
     * not set.
     * @param {TVenomWalletEvents} event name of the desired event.
     */
    @observable
    public removeEventListeners (event?: TVenomWalletEvents) {
        if (!event) this.#eventListeners = {};
        else this.#eventListeners[event] = [];
    }

    /**
     * Method to trigger a specific event within a controller.
     *
     * @param {TVenomWalletEvents} event name of the desired event.
     * @param {any} args arguments for the event callback function.
     * @private
     */
    private callEvent (event: TVenomWalletEvents, ...args: any) {
        if (this.#eventListeners[event]) this.#eventListeners[event]?.forEach(eventCallback => eventCallback(...args));
    }
}

const venomWallet = new VenomWalletController();
export default venomWallet;
