const TerserPlugin = require("terser-webpack-plugin");

const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const packageConfig = {
    mode: "production",
    output: {
        path: path.resolve(__dirname, "package", "dist"),
        filename: "[name].js",
        library: {
            name: "VenomWalletController",
            type: "umd"
        },
        clean: true
    },

    target: "web",

    resolve: {
        extensions: [ ".tsx", ".jsx", ".js", ".ts" ]
    },

    stats: "minimal",

    entry: {
        "VenomWalletController": path.resolve(__dirname, "package", "VenomWalletController"),
        "utils/waiting-venom-promise": path.resolve(__dirname, "package", "utils", "waiting-venom-promise"),
        "utils/init-venom-connect": path.resolve(__dirname, "package", "utils", "init-venom-connect")
    },

    plugins: [],

    module: {
        rules: [
            {
                test: /\.jsx?$/i,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.tsx?$/i,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                    options: {
                        configFile: "tsconfig.json"
                    }
                }
            },
            {
                test: /\.s[ac]ss$/i,
                use: [ MiniCssExtractPlugin.loader, "css-loader", "postcss-loader", "sass-loader" ]
            }
        ]
    },

    externals: {
        "mobx": {
            commonjs: "mobx",
            commonjs2: "mobx",
            amd: "mobx"
        },
        "@knownout/base-controller": {
            commonjs: "@knownout/base-controller",
            commonjs2: "@knownout/base-controller",
            amd: "@knownout/base-controller"
        },
        "everscale-inpage-provider": {
            commonjs: "everscale-inpage-provider",
            commonjs2: "everscale-inpage-provider",
            amd: "everscale-inpage-provider"
        },
        "everscale-standalone-client": {
            commonjs: "everscale-standalone-client",
            commonjs2: "everscale-standalone-client",
            amd: "everscale-standalone-client"
        },
        "venom-connect": {
            commonjs: "venom-connect",
            commonjs2: "venom-connect",
            amd: "venom-connect"
        },
        "react-is": {
            commonjs: "react-is",
            commonjs2: "react-is",
            amd: "react-is"
        },
        "bignumber.js": {
            commonjs: "bignumber.js",
            commonjs2: "bignumber.js",
            amd: "bignumber.js"
        }
    },

    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: {
                        comments: false
                    }
                }
            })
        ]
    }
};

packageConfig.module.rules[1].use.options.configFile = "tsconfig.package.json";
module.exports = packageConfig;
