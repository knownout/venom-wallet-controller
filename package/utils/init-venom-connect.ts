import { ProviderRpcClient } from "everscale-inpage-provider";
import { EverscaleStandaloneClient } from "everscale-standalone-client";
import { VenomConnect } from "venom-connect";

const initVenomConnect = async () => new VenomConnect({
    theme: "dark",
    providersOptions: {
        venomwallet: {
            links: {
                extension: [
                    {
                        browser: "chrome",
                        link: "https://chrome.google.com/webstore/detail/venom-wallet/ojggmchlghnjlapmfbnjholfjkiidbch"
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
        }
    }
});

export default initVenomConnect;
