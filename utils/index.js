const EC = require('elliptic').ec;
const cryptoHash = require('./crypto-hash');

const ec = new EC('secp256k1'); //standards of efficient cryptography (256bits) k1->generates prime number

const verifySignature = ({ publicKey,data,signature }) => {
    const keyFromPublic = ec.keyFromPublic(publicKey, 'hex');

    return keyFromPublic.verify(cryptoHash(data),signature);
}

module.exports = { ec,verifySignature,cryptoHash };
