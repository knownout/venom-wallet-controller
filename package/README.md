# Venom wallet controller

Venom wallet controller that allows to connect the wallet to decentralized application and get basic data and providers.

## Table of Contents

- [Getting started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

# Getting started

Fist clone repository and install dependencies:
```shell
git clone https://github.com/knownout/venom-wallet-controller
cd venom-wallet-controller
```

Then you should prepare a repository:
```shell
npm i -g pnpm # if not yet installed
pnpm install
npx husky install
```

Now, after each commit, package will be automatically built and published to npm registry.

# Usage

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

Method `initController` also supports custom `venom-connect` initialization function:
```ts
const initVenomConnect = async (networkID = 1000) => new VenomConnect({ /* configuration */ })

venomWallet.initController(initVenomConnect);
```

&nbsp;

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

&nbsp;

To get a standalone client or an inpage provider, use the following methods:

```ts
venomWallet.standaloneClient // Getter

venomWallet.rpcClient // Getter
```

&nbsp;

List of all available public methods:

| Method                   | Return type             | Description                                                                 |
|--------------------------|-------------------------|-----------------------------------------------------------------------------|
| `get rpcClient`          | `ProviderRpcClient`     | Returns inpage provider                                                     |
| `get standaloneClient`   | `ProviderRpcClient`     | Returns standalone client                                                   |
| `initController`         | `Promise<void>`         | Initializes controller, should be called only once                          |
| `changeDefaultNetworkID` | `VenomWalletController` | Changes default chain ID, should be called before controller initialization |
| `changeWalletAccount`    | `VenomWalletController` | Prompts user to change currently connected account                          |
| `addEventListener`       | `void`                  | Adds new event listener for certain actions                                 |
| `removeEventListener`    | `void`                  | Removes specified event listener                                            |
| `removeEventListeners`   | `void`                  | Removes all event listeners for specified event                             |


&nbsp;

List of events:

| Event                   | Description                                       |
|-------------------------|---------------------------------------------------|
| `walletDisconnected`    | Fires when wallet disconnected                    |
| `walletConnected`       | Fires when wallet connected                       |
| `controllerInitialized` | Fires when controller initialization finished     |
| `contractStateChanged`  | Fires when wallet contract state changes          |

## Contributing

Please refer to project's code style for submitting patches and additions.

1. Fork the repo on GitHub
2. Clone the project to your own machine.
3. If you're fixing bug or adding a new feature, create related issue.
4. Commit changes to your own branch.
5. Push your work back up to your fork.
6. Submit a Pull request so that we can review your changes.

NOTE: Be sure to merge the latest from "upstream" before making a pull request!

# License

You can copy and paste the MIT license summary from below.

```text
MIT License

Copyright (c) 2022-2023 Alexandr Slavinskii

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

&nbsp;

<p align="center" dir="auto">
  <a href="https://github.com/venom-blockchain/developer-program">
    <img src="https://raw.githubusercontent.com/venom-blockchain/developer-program/main/vf-dev-program.png" alt="Logo" width="366.8" height="146.4" style="max-width: 100%;">
  </a>
</p>

&nbsp;

https://venom.foundation
<br>knownout - https://github.com/knownout/
<br>knownout@hotmail.com
