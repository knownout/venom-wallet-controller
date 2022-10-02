import BaseController from "@knownout/base-controller";
import { waitingVenomPromise } from "./utils/waiting-venom-promise";
import BigNumber from "bignumber.js";
import {
    Address, FullContractState, hasEverscaleProvider, ProviderRpcClient, Subscription
} from "everscale-inpage-provider";
import { action, computed, makeObservable, observable } from "mobx";
import { VenomConnect } from "venom-connect";
import initVenomConnect from "./utils/init-venom-connect";

export type TVenomWalletAccountData = {
    address: Address;
    contractType: string;
    publicKey: string;
}

/**
 * Provider instance, can only be overwritten
 * when connecting a new provider.
 * @type {ProviderRpcClient}
 */
let rpcClient = new ProviderRpcClient({
    forceUseFallback: true,
    fallback: () => waitingVenomPromise()
});

interface IVenomWalletState {
    /** True only if the wallet is connected. */
    connected: boolean;

    /**
     * True only on controller initialization, not updated
     * when changing wallet.
     */
    loading: boolean;

    /** Current wallet balance, updated in real time. */
    balance?: BigNumber;
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
}

/**
 * Venom wallet controller based on venom-connect.
 */
class VenomWalletController extends BaseController<IVenomWalletState, IVenomWalletData> {

    @observable private venomConnect?: VenomConnect;

    #standaloneClient: ProviderRpcClient | null = null;

    #walletContractSubscription?: Subscription<"contractStateChanged">;

    #walletPermissionsSubscription?: Subscription<"permissionsChanged">;

    constructor () {
        super({ connected: false, loading: true }, {});
        makeObservable(this);
    }

    /**
     * Method for getting inpage provider.
     * @return {ProviderRpcClient | null} inpage provider instance or null if not initialized.
     */
    public get rpcClient () { return rpcClient; }

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
        this.venomConnect = await (initFunction ?? initVenomConnect)();

        // Check if browser extension is installed
        const walletInstalled = await hasEverscaleProvider();

        this.setData({ walletInstalled });
        if (!walletInstalled) {
            this.setState("loading", false);
            return;
        }

        // Get a standalone client instance
        this.#standaloneClient = await this.venomConnect.getStandalone();

        // Check if wallet is connected
        const walletAccount = await this.checkWalletAuthentication();

        // If connected, then update states
        if (walletAccount) {
            if (this.venomConnect.currentProvider) rpcClient = this.venomConnect.currentProvider;
            this.createWalletSubscription?.();

            await this.updateWalletContract();

            this.setData({ walletAccount });
        }

        this.setState({ connected: !!walletAccount, loading: false });
    }

    /**
     * Method for calling the relevant action to connect or disconnect the wallet.
     */
    @action
    public callWalletAction () {
        // If wallet is connected, then disable it ...
        if (this.state.connected) this.disconnectWallet?.();

        // ... and vice versa
        else this.connectWallet?.();
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
            this.#walletContractSubscription.unsubscribe?.();
            this.#walletContractSubscription = undefined;
        }

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
        this.setData("walletContract", state);
    }

    /**
     * Method for checking the connection of the wallet to this application.
     *
     * @return {Promise<boolean | TVenomWalletAccountData>} false if not connected, otherwise — account data.
     * @protected
     */
    protected async checkWalletAuthentication () {
        if (!this.venomConnect || !this.standaloneClient) return false;

        const providerState = await this.rpcClient.getProviderState();
        if (!providerState || !providerState.permissions.accountInteraction) return false;

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
        if (!this.venomConnect) return;

        // Kill the current subscription (if it exists).
        if (this.#walletPermissionsSubscription) {
            this.#walletPermissionsSubscription.unsubscribe?.();
            this.#walletPermissionsSubscription = undefined;
        }

        // Create a new subscription to permissions change.
        this.#walletPermissionsSubscription = await this.rpcClient.subscribe("permissionsChanged");

        this.#walletPermissionsSubscription.on("data", async data => {
            if (!data.permissions.accountInteraction) return;

            this.createWalletSubscription();
            await this.updateWalletContract();

            this.setState({ connected: true });
            this.setData({ walletAccount: data.permissions.accountInteraction });

            if (this.venomConnect && this.venomConnect.currentProvider) rpcClient = this.venomConnect.currentProvider;
            this.#walletPermissionsSubscription?.unsubscribe?.();
            this.#walletPermissionsSubscription = undefined;
        });

        // Calling the venom-connect modal window.
        await this.venomConnect.connect();
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
    protected async disconnectWallet () {
        if (!this.rpcClient || !this.venomConnect) return;

        await this.rpcClient.disconnect();

        this.resetState("loading");
        this.resetData("walletInstalled", "walletVersion");
    }
}

const venomWallet = new VenomWalletController();
export default venomWallet;
