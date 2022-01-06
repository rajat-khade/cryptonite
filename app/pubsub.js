const PubNub = require('pubnub');

const credentials = {
    publishKey: 'pub-c-641a6d5b-bb4e-40b2-b989-d7fc958f5a65',
    subscribeKey: 'sub-c-8d4a6d1c-b0bf-11eb-a3cb-9a3343cb4534',
    secretKey: 'sec-c-MGE1ZTVlZDMtZmViMi00Mzg5LWJiNjAtNGJkNDI5NDE5ZTM0'
};

const CHANNELS = {
    TEST: 'TEST',
    BLOCKCHAIN: 'BLOCKCHAIN',
    TRANSACTION: 'TRANSACTION'
};

class PubSub {
    constructor({ blockchain, transactionPool, wallet }) {
        this.blockchain = blockchain;
        this.wallet = wallet;
        this.transactionPool = transactionPool;

        this.pubnub = new PubNub(credentials);

        this.pubnub.subscribe({ channels: Object.values(CHANNELS) });

        this.pubnub.addListener(this.listener());
    }

    broadcastChain() {
        this.publish({
            channel: CHANNELS.BLOCKCHAIN,
            message: JSON.stringify(this.blockchain.chain)
        });
    }

    subscribeToChannels() {
        this.pubnub.subscribe({
            channels: [Object.values(CHANNELS)]
        });
    }

    listener() {
        return {
            message: messageObject => {
                const { channel, message } = messageObject;

                console.log(`Message received. Channel: ${channel}. Message: ${message}`);
                const parsedMessage = JSON.parse(message);

                switch (channel) {
                    case CHANNELS.BLOCKCHAIN:
                        this.blockchain.replaceChain(parsedMessage,true,()=>{
                            this.transactionPool.clearBlockchainTransactions({
                                chain: parsedMessage
                            });
                        });
                        break;
                    case CHANNELS.TRANSACTION:
                        if(!this.transactionPool.existingTransaction({
                            inputAddress: this.wallet.publicKey
                        })) {
                            this.transactionPool.setTransaction(parsedMessage);
                        }
                        break;
                    default:
                        return;
                }
            }
        }
    }

    publish({ channel, message }) {
        // there is an unsubscribe function in pubnub
        // but it doesn't have a callback that fires after success
        // therefore, redundant publishes to the same local subscriber will be accepted as noisy no-ops
        this.pubnub.publish({ message, channel });
    }

    broadcastTransaction(transaction) {
        this.publish({
            channel: CHANNELS.TRANSACTION,
            message: JSON.stringify(transaction)
        });
    }

}

// const testPubSub = new PubSub();
// testPubSub.publish({ channel: CHANNELS.TEST, message: 'hello blochchain' });

module.exports = PubSub;