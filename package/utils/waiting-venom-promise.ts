import { Provider } from "everscale-inpage-provider"

export const waitingVenomPromise = () => new Promise(resolve => {
    const interval = setInterval(() => {
        // @ts-ignore
        if (window.__venom) {
            clearInterval(interval)
            // @ts-ignore
            resolve(window.__venom)
        }
    }, 500)
}) as Promise<Provider>
