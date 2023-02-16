import { ProviderRpcClient } from "everscale-inpage-provider";
import { EverscaleStandaloneClient } from "everscale-standalone-client";
import { VenomConnect } from "venom-connect";

const initVenomConnect = async (networkID = 1000) => new VenomConnect({
    theme: "dark",
    checkNetworkId: networkID,
    providersOptions: {
        venomwallet: {
            links: {
                extension: [
                    {
                        browser: "chrome",
                        link: "https://chrome.google.com/webstore/detail/venom-wallet/ojggmchlghnjlapmfbnjholfjkiidbch"
                    }, {
                        browser: "chrome",
                        link: "https://chrome.google.com/webstore/detail/ever-wallet/cgeeodpfagjceefieflmdfphplkenlfk"
                    }, {
                        browser: "firefox",
                        link: "https://addons.mozilla.org/en-US/firefox/addon/ever-wallet"
                    }
                ],
                android: undefined,
                ios: null
            },
            walletWaysToConnect: [
                {
                    package: ProviderRpcClient,

                    packageOptions: {
                        fallback:
                            VenomConnect.getPromise("venomwallet", "extension")
                            || (() => Promise.reject()),
                        forceUseFallback: true
                    },
                    packageOptionsStandalone: {
                        fallback: () => EverscaleStandaloneClient.create({
                            connection: {
                                id: 1000,
                                group: "venom_mainnet",
                                type: "jrpc",
                                data: {
                                    endpoint: "https://jrpc.venom.foundation/rpc"
                                }
                            }
                        }),
                        forceUseFallback: true
                    },

                    id: "extension",
                    type: "extension"
                }
            ],
            defaultWalletWaysToConnect: [ "mobile", "ios", "android" ]
        },

        everwallet: {
            walletWaysToConnect: [
                {
                    package: ProviderRpcClient,
                    packageOptions: {
                        fallback: VenomConnect.getPromise("everwallet", "extension")
                            || (() => Promise.reject()),
                        forceUseFallback: true
                    },
                    packageOptionsStandalone: {
                        fallback: () => EverscaleStandaloneClient.create({
                            connection: {
                                id: 1000,
                                group: "venom_mainnet",
                                type: "jrpc",
                                data: {
                                    endpoint: "https://jrpc.venom.foundation/rpc"
                                }
                            }
                        }),
                        forceUseFallback: true
                    },
                    id: "extension",
                    type: "extension"
                }
            ]
        }
    }
});

export default initVenomConnect;
