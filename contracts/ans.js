



export async function handle(state, action){

    const input = action.input
    const caller = action.caller
    // STATE
    const users = state.users
    const balances = state.balances
    const availableLabels = state.availableLabels
    const foreignCalls = state.foreignCalls
    const invocations = state.invocations
    const deposits = state.deposits
    const withdrawals = state.withdrawals
   // CONSTANTS
    const WDLT = "FdY68iYqTvA40U34aXQBBYseGmIUmLV-u57bT7LZWm0";
    //SMARTWEAVE API
    const blockHeight = SmartWeave.block.height

    // alphabetical lower case characters + integers from 0 to 9
    const allowedCharCodes = [48, 49, 50, 51, 52, 53, 54, 55, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102, 103, 104,
                             105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122 ]; 
    // ERRORS LIST, 
    const ERROR_INVALID_ARWEAVE_ADDRESS = "the provided string is not a valid Arweave address";
    const ERROR_INVALID_PRIMITIVE_TYPE = "the function was supplied by an invalid primitive type";
    const ERROR_MISSING_REQUIRED_PARAMETER = "the function still require parameters";
    const ERROR_INVALID_STRING_LENGTH = "the supplied string length is not accepted";
    const ERROR_INVALID_CHARCODE = "the string contains an invalid character code";
    const ERROR_LABEL_SUPPLY_IS_ZERO = "label's supply is consumed";
    const ERROR_LABEL_ALREADY_ACQUIRED = "the given label has been minted";
    const ERROR_MISSING_REQUIRED_TAG = "the transaction requires a missing tag";
    const ERROR_INVALID_AVATAR_TYPE = "only image/* MIME type is allowed for avatars";
    const ERROR_CALLER_EXIST = "the caller has already init-mint";
    const ERROR_USER_HAS_NOT_REGISTERED = "caller must execute 'setProfile' before performing this action";
    const ERROR_INVALID_LABEL_FORMAT = "the given string is not a valid label";
    const ERROR_LABEL_DOES_NOT_RESOLVE = "the given label does not resolve to an address";
    const ERROR_DATA_TYPE_UNSUPPORTED = "the provided primitive type is not supported";
    const ERROR_INVALID_LENGTH = "options entries count exceed the limits";
    const ERROR_DUPLICATED_TX = "this transaction's deposit has been already reflected";
    const ERROR_INVALID_DEPOSITOR = "the function's caller is not the deposit TXID owner";
    const ERROR_INVALID_DEPOSIT_TX = "the provided deposit transaction is not valid";
    const ERROR_MISSING_INPUT_PROPOERTY = "missing a reuired Input's key";
    const ERROR_WRONG_FCP_FUNCTION = "deposit's function must be a 'transfer'";
    const ERROR_INVALID_TARGET = "deposit's TX target must be equal to this contract ID";
    const ERROR_CALLER_NOT_REGISTERED = "the caller has not deposited before";
    const ERROR_NOT_INTEGER = "only ineteger values are allowed";
    const ERROR_AMOUNT_TOO_HIGH = "the withdrawal qty is higher than the caller's balance";
    const ERROR_INVALID_WITHDRAWAL_AMOUNT = "only positive, non-zero integers are allowed";

    if (input.function === "deposit") {
        const tx = input.tx

        if ( deposits.includes(tx) ) {
            throw new ContractError(ERROR_DUPLICATED_TX)
        }

        const txObject = await SmartWeave.unsafeClient.transactions.get(tx)
        const txOwner = txObject["owner"]
        const ownerAddress = await SmartWeave.unsafeClient.wallets.ownerToAddress(txOwner)

        if (ownerAddress !== caller) {
            throw new ContractError(ERROR_INVALID_DEPOSITOR)
        }

        const fcpTxsValidation = await SmartWeave.contracts.readContractState(WDLT, void 0, true)
        const validity = fcpTxsValidation["validity"]

        if (! validity[tx] ) {
            throw new ContractError(ERROR_INVALID_DEPOSIT_TX)
        }

        // await _validateDepositTransaction(tx, caller);
        const depositQty = await _getDepositQty(tx);

        if (! balances[caller]) {
            balances[caller] = 0
        };

        balances[caller] += depositQty
        deposits.push(tx)

        return { state }

    };

    if (input.function === "setProfile") {

        const username = input.username
        const bio = input.bio
        let avatar = input.avatar

        _validateArweaveAddress(caller);
        _validateStringTypeLength(bio, 0, 75);
        _validateStringTypeLength(username, 2, 7);

        const label = _validateUsername(username);
        const labelScarcity = _getUsernameScarcity(label);
        const labelMintingCost = _getMintingCost(label);

        if (availableLabels[labelScarcity] === 0) {
            throw new ContractError(ERROR_LABEL_SUPPLY_IS_ZERO)
        }


        if (users.find(user => user["user"] === caller )) {
            throw new ContractError(ERROR_CALLER_EXIST)
        }
        
        if (avatar.length === 0) {
            avatar = "78WdrVhNZ2i_KbimqcV4j-drX04HJr3E6UyD7xWc84Q"
        } else {
            await _validateAvatar(avatar)
        }

        // subs 1 from the label supply
        availableLabels[labelScarcity] -= 1
        _checkAndSubstractMintingCost(labelMintingCost, caller)


        const labelObject = {
            label: label,
            scarcity: labelScarcity,
            acquisationBlock: SmartWeave.block.height,
            mintedFor: labelMintingCost
        }

        users.push({
            user: caller,
            currentLabel: label,
            ownedLabels: [labelObject],
            bio: bio,
            avatar: avatar
        })

        console.log("STATE IN SETPROFILE")
        console.log(state)

        return { state }
    }

    if (input.function === "mint") {

        const username = input.username

        _validateArweaveAddress(caller);
        _validateStringTypeLength(username, 2, 7);

        const label = _validateUsername(username);
        const labelScarcity = _getUsernameScarcity(label);
        const labelMintingCost = _getMintingCost(label);

        if (availableLabels[labelScarcity] === 0) {
            throw new ContractError(ERROR_LABEL_SUPPLY_IS_ZERO)
        }

        const callerIndex = users.findIndex(user => user["user"] === caller) 

        if ( callerIndex === -1 ) {
            throw new ContractError(ERROR_USER_HAS_NOT_REGISTERED)
        }

        const labelObject = {
            label: label,
            scarcity: labelScarcity,
            acquisationBlock: SmartWeave.block.height,
            mintedFor: labelMintingCost
        }


        availableLabels[labelScarcity] -= 1
         _checkAndSubstractMintingCost(labelMintingCost, caller)
        users[callerIndex]["ownedLabels"].push(labelObject)

        return { state }

    }



    // WDLT ACTIONS



    if (input.function === "getAddressOf") {

        const label = input.label
        const validatedLabel = _getLabel(label);
        const userObject = state.users.find(user => user["currentLabel"] === validatedLabel)
        const address = userObject["user"]

        if (! address) {
            throw new ContractError(ERROR_LABEL_DOES_NOT_RESOLVE)
        }

        return {
            result:{
                address: address
            }
        }
    };

    if (input.function === "withdraw") {
        const qty = input.qty

        if (! balances[caller]) {
            throw new ContractError(ERROR_CALLER_NOT_REGISTERED)
        };

        _validateWithdrawQty(qty);

        balances[caller] -= qty

        const invocation = {
          function: "transfer",
          target: caller,
          qty: qty
        };

        state.foreignCalls.push({
          contract: WDLT,
          input: invocation
        });

        withdrawals.push(SmartWeave.transaction.id)

        return { state }

    }



    // HELPER FUNCTIONS
    function _validateArweaveAddress(address) {
        if (typeof address !== "string" || address.length !== 43) {

            throw new ContractError(ERROR_INVALID_ARWEAVE_ADDRESS)
        }
    };

    function _validateStringTypeLength(string, minLen, maxLex) {

        if (typeof string !== "string") {
            throw new ContractError(ERROR_INVALID_PRIMITIVE_TYPE)
        }

        if (minLen === void 0 || maxLex === void 0) {
            throw new ContractError(ERROR_MISSING_REQUIRED_PARAMETER)
        }

        if (string.length < minLen || string.length > maxLex) {
            throw new ContractError(ERROR_INVALID_STRING_LENGTH)
        }
    };


    function _validateUsername(username, option) {

        const caseFolded = username.toLowerCase()
        const normalizedUsername = caseFolded.normalize("NFKC")

        const stringCharcodes = normalizedUsername.split('').map( char => char.charCodeAt(0));

        for (let charCode of stringCharcodes) {
            if (! allowedCharCodes.includes(charCode)) {
                throw new ContractError(ERROR_INVALID_CHARCODE)
            }
        }

        if (normalizedUsername.length < 2 || normalizedUsername.length > 7) {
            throw new ContractError(ERROR_INVALID_STRING_LENGTH)
        }
        // used to just validate label's syntax
        // and return the normalized label string
        if (option === "read") {
            return normalizedUsername
        }

        if ( users.find(user => ( (user["currentLabel"] === normalizedUsername) || (user["ownedLabels"].includes(normalizedUsername)) )) ) {
            throw new ContractError(ERROR_LABEL_ALREADY_ACQUIRED)
        }

        // return the proccessed username
        return normalizedUsername
    };

    async function _validateAvatar(avatar) {

        const tagsMap = new Map();
        const avatar_tx = await SmartWeave.unsafeClient.transactions.get(avatar);
        const tags = avatar_tx.get("tags");

        for (let tag of tags) {
        let key = tag.get("name", {decode: true, string: true});
        let value = tag.get("value", {decode: true, string: true});
        tagsMap.set(key, value)
        }

        if (! tagsMap.has("Content-Type")) {
            throw new ContractError(ERROR_MISSING_REQUIRED_TAG)
        }

        if (! tagsMap.get("Content-Type").startsWith("image/")) {
            throw new ContractError(ERROR_INVALID_AVATAR_TYPE)
        }
    };


    function _getUsernameScarcity(username) {

        switch (username.length) {
            case 2:
                return "ni"
            case 3:
                return "san"
            case 4:
                return "shi"
            case 5:
                return "go"
            case 6:
                return "roku"
            case 7:
                return "shichi"
            default:
                throw new ContractError(ERROR_INVALID_STRING_LENGTH)
        }
    };

    function _getMintingCost(username) {

        switch (username.length) {
            case 2:
                return 1
            case 3:
                return 0.1
            case 4:
                return 0.01
            case 5:
                return 0.001
            case 6:
                return 0.0001
            case 7:
                return 0.00001
        }
    };

    function _getLabel(username) {

        if ( (typeof username !== "string") || (! username.endsWith(".ar")) )  {
            throw new ContractError(ERROR_INVALID_LABEL_FORMAT)
        }

        const radical = username.slice(0, username.indexOf(".ar")) ;
        const label = _validateUsername(radical, "read");

        return label
    };

    function _validateInteger(number, allowNull) {

        if ( typeof allowNull === "undefined" ) {
            throw new ContractError("ERROR_REQUIRED_ARGUMENT")
        }

        if (! Number.isInteger(number) ) {
            throw new ContractError("ERROR_INVALID_NUMBER_TYPE")
        }

        if (allowNull) {
            if (number < 0) {
                throw new ContractError("ERROR_NEGATIVE_INTEGER")
            }
        } else if (number <= 0) {
            throw new ContractError("ERROR_INVALID_NUMBER_TYPE")
        }
    }


    // async function _validateDepositTransaction(txid, address) {


    // }

    async function _getDepositQty(txid) {

        const tagsMap = new Map();

        const depositTransactionObject = await SmartWeave.unsafeClient.transactions.get(txid);
        const depositTransactionTags = depositTransactionObject.get("tags");

        for (let tag of depositTransactionTags) {
          const key = tag.get("name", {decode: true, string: true})
          const value = tag.get("value", {decode: true, string: true})
          tagsMap.set(key, value)
        }

        if (! tagsMap.has("Input")) {
          throw new ContractError(ERROR_MISSING_REQUIRED_TAG)
        }

        const inputObject = JSON.parse( tagsMap.get("Input") )
        const inputsMap = new Map( Object.entries(inputObject) )

        if (! inputsMap.has("qty")) {
          throw new ContractError(ERROR_MISSING_INPUT_PROPOERTY)
        }

        if (! inputsMap.has("function") ) {
            throw new ContractError(ERROR_MISSING_INPUT_PROPOERTY)
        }

        if (inputsMap.get("function") !== "transfer") {
          throw new ContractError(ERROR_WRONG_FCP_FUNCTION)
        }

        if (inputsMap.get("target") !== SmartWeave.contract.id) { 
          throw new ContractError(ERROR_INVALID_TARGET)
        }

        return inputsMap.get("qty")

    };

    function _validateWithdrawQty(qty) {

        if (! Number.isInteger(qty) ) {
            throw new ContractError(ERROR_NOT_INTEGER)
        }

        if (qty > balances[caller]) {
            throw new ContractError(ERROR_AMOUNT_TOO_HIGH)
        }

        if (qty <= 0) {
            throw new ContractError(ERROR_INVALID_WITHDRAWAL_AMOUNT)
        }
    }

    function _checkAndSubstractMintingCost(mintingCost, address) {

        if (! balances[address]) {
            throw new ContractError(ERROR_CALLER_NOT_REGISTERED)
        }

        if (balances[address] < mintingCost) {
            throw new ContractError(ERROR_UNSUFFICIENT_BALANCE)
        }

        balances[address] -= mintingCost
    }

}





