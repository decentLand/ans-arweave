// imports
const express = require("express");
const { SmartWeaveNodeFactory } = require("redstone-smartweave");
const Arweave = require("arweave");
let secureEnv = require("secure-env");


// Configs
const arweave = Arweave.init({
	host: "arweave.net",
	protocol: "https",
	port: 443,
	timeout: 20000,
	logging: false
});

const smartweave = SmartWeaveNodeFactory.memCached(arweave);
const app = express();
const port = process.env.PORT || 3000
global.env = secureEnv({secret: 'secret'});
const jwk = JSON.parse( global.env.WALLET_KEY ) // this is the experimental key exposed

// functions
async function addressOf(label) {

	const contract = smartweave.contract("yy8nP0EN7CoJLRG2ot65iBMpvuS9VGeU1CepaV4hrNg").connect(jwk);


	const response = await contract.viewState({
		function: "getAddressOf",
		label: `${label}.ar`
	});


	if (response.type !== "ok") {
		return response.errorMessage
	};

	return response.result
}


app.get("/address/:label", async(req, res) => {
	res.setHeader('Content-Type', 'application/json');
	const address = await addressOf( req.params.label )

	res.send(address)
});

app.listen(port, () => {
      console.log(`listening at http://localhost:${port}`)
});

