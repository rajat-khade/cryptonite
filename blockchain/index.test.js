const Blockchain = require('./index');
const Block = require('./block');
const { cryptoHash } = require('../utils');
const Wallet = require('../wallet');
const Transaction = require('../wallet/transaction');

describe('Blockchain',()=>{
    let blockchain, newChain, originalChain, errorMock;

    beforeEach(()=>{
        errorMock = jest.fn();
        blockchain = new Blockchain();
        newChain = new Blockchain();
        originalChain = blockchain.chain;
        global.console.error = errorMock;
    });

    it('it contains a `chain` Array instance',()=>{
        expect(blockchain.chain instanceof Array).toBe(true);
    });
    it('starts with genesis block',()=>{
        expect(blockchain.chain[0]).toEqual(Block.genesis());
    });
    it('adds a new block to the chain',()=>{
        const newData = 'foo-dummy';
        blockchain.addBlock({ data: newData });
        expect(blockchain.chain[blockchain.chain.length-1].data).toEqual(newData);
    });

    describe('isValidChain()',()=>{
        describe('when the chain does not start with the genesis block',()=>{
            it('returns false',()=>{
                blockchain.chain[0] = { data: 'fake-genesis' };
                expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
            });
        });
        describe('when the chain starts with the genesis block and has mulitple blocks',()=>{
            beforeEach(()=>{
                blockchain.addBlock({data: 'rajat'});
                blockchain.addBlock({data: 'khade'});
                blockchain.addBlock({data: 'rocky'});
            });

            describe('and a lastHash reference has changed',()=>{
                it('returns false',()=>{
                    blockchain.chain[2].lastHash = 'broken-lastHash';
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
                });
            });

            describe('and the chain contains a block with an invalid field',()=>{
                it('returns false',()=>{
                    blockchain.chain[2].data = 'some-bad-data';
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
                });
            });

            describe('and the chain contains a block with an invalid field',()=>{
                it('returns false',()=>{
                    const lastBlock = blockchain.chain[blockchain.chain.length-1];
                    const lastHash = lastBlock.hash;
                    const timestamp = Date.now();
                    const nonce = 0;
                    const data = [];
                    const difficulty = lastBlock.difficulty - 3;
                    const hash = cryptoHash(timestamp,lastHash,difficulty,nonce,data);

                    const badBlock = new Block({
                        timestamp,lastHash,hash,nonce,difficulty,data
                    });

                    blockchain.chain.push(badBlock);
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
                });
            });

            describe('and the chain does not contain any invalid blocks',()=>{
                it('returns true',()=>{
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(true);
                })
            });
        });
    });

    describe('replaceChain()',()=>{
        let logMock;

        beforeEach(()=>{
            logMock=jest.fn();
            global.console.log=logMock;
        });

        describe('when the new chain is not longer',()=>{
            beforeEach(()=>{
                newChain.chain[0] = { new: 'chain' };
                blockchain.replaceChain(newChain.chain);
            });

            it('does not replace the chain',()=>{
                expect(blockchain.chain).toEqual(originalChain);
            });

            it('logs an error',()=>{
                expect(errorMock).toHaveBeenCalled();
            });
        })

        describe('when the chain is longer',()=>{
            beforeEach(()=>{
                newChain.addBlock({data: 'rajat'});
                newChain.addBlock({data: 'khade'});
                newChain.addBlock({data: 'rocky'});
            });
            describe('and the chain is invalid',()=>{
                beforeEach(()=>{
                    newChain.chain[2].hash = 'some-fake-hash';
                    blockchain.replaceChain(newChain.chain);
                });

                it('does not replace the chain',()=>{
                    expect(blockchain.chain).toEqual(originalChain);
                });

                it('logs an error',()=>{
                    expect(errorMock).toHaveBeenCalled();
                });
            });

            describe('and the chain in valid',()=>{
                beforeEach(()=>{
                    blockchain.replaceChain(newChain.chain);
                });

                it('replaces the chain',()=>{
                    expect(blockchain.chain).toEqual(newChain.chain);
                });

                it('it logs about chain replacement',()=>{
                    expect(logMock).toHaveBeenCalled();
                });
            });
        });

        describe('and the validateTransaction flag is true',()=>{
            it('calls validTransactionData()',()=>{
                const validTransactionDataMock=jest.fn();

                blockchain.validTransactionData=validTransactionDataMock;
                newChain.addBlock({data: 'foo'});
                blockchain.replaceChain(newChain.chain,true);
                expect(validTransactionDataMock).toHaveBeenCalled();
            });
        });
    });

    describe('validTransactionData()',()=>{
        let transaction,rewardTransaction,wallet;

        beforeEach(()=>{
            wallet = new Wallet();
            transaction = wallet.createTransaction({recipient: 'foo-address',amount: 65});
            rewardTransaction = Transaction.rewardTransaction({minerWallet: wallet});
        });

        describe('transaction data is valid',()=>{
            it('returns true',()=>{
                newChain.addBlock({data: [transaction,rewardTransaction]});

                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(true);

            });
        });

        describe('transaction data has multiple rewards',()=>{
            it('returns false and logs errors',()=>{
                newChain.addBlock({data:[transaction,rewardTransaction,rewardTransaction]});
                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();
            });
        });

        describe('transaction data has atleast 1 malformed output map',()=>{
            describe('and the transaction is not a reward transaction',()=>{
                it('returns false and logs errors',()=>{
                    transaction.outputMap[wallet.publicKey] = 9999;
                    newChain.addBlock({data: [transaction,rewardTransaction]});
                    expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });

            describe('and the transaction is a reward transaction',()=>{
                it('returns false and logs errors',()=>{
                    rewardTransaction.outputMap[wallet.publicKey] = 9999;
                    newChain.addBlock({data:[transaction,rewardTransaction]});
                    expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });
        });

        describe('and the transaction data has atleast one wrong input',()=>{
            it('returns false and logs errors',()=>{
                wallet.balance = 8000;
                const wrongOutputMap = {
                    [wallet.publicKey]: 7900,
                    someRecipient: 100
                };
                const wrongTransaction = {
                    input: {
                        timestamp: Date.now(),
                        amount: wallet.balance,
                        address: wallet.publicKey,
                        signature: wallet.sign(wrongOutputMap)
                    },
                    outputMap: wrongOutputMap
                }
                newChain.addBlock({data: [wrongTransaction,rewardTransaction]});

                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();
            });

        });

        describe('block has multiple identical transactions',()=>{
            it('returns false and logs errors',()=>{
                newChain.addBlock({data:[transaction,transaction,transaction,rewardTransaction]});

                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();

            });
        });
    });
});
