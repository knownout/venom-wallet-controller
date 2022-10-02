# 💷 Venom wallet controller

Venom wallet controller that allows to connect the wallet to decentralized application and get basic data and providers.

Before using the controller, you need to initialize it:

```tsx
import venomWallet from "@knownout/venom-wallet-controller"

function App () {
    useEffect(() => {
        // Since the initialization should only be done
        // once, we do it inside the effect.
        venomWallet.initController();
    }, []);

    return (
        <div>
            { /* ... */ }
        </div>
    );
}
```

To connect or disconnect the wallet, you can call the `callWalletAction` method:

```tsx
function App () {
    return (
        <button
            onClick={ () => venomWallet.callWalletAction() }
            disabled={ venomWallet.state.loading }
        >
            {
                venomWallet.state.loading
                    ? "Loading"
                    : venomWallet.data.walletInstalled
                        ? venomWallet.state.connected
                            ? "Disconnect wallet"
                            : "Connect wallet"
                        : "Wallet not installed"
            }
        </button>
    )
}
```

To get a standalone client or an inpage provider, use the following methods:

```ts
venomWallet.standaloneClient // Getter

venomWallet.rpcClient // Getter
```

https://venom.foundation
<br>re-knownout - https://github.com/re-knownout/
<br>knownout@hotmail.com
