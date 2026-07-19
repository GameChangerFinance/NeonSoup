export const GRAPHQL_MK2_OPERATIONS = {
  openOffers: 'NeonSoup_GetOpenOfferCandidates',
  addressUtxos: 'NeonSoup_GetAddressUtxos',
  assetsById: 'NeonSoup_GetAssetsById',
  confirmedTransactions: 'NeonSoup_GetConfirmedTransactions',
  transactionsByHash: 'NeonSoup_GetTransactionsByHash',
  transactionsByHashNoFee: 'NeonSoup_GetTransactionsByHashNoFee',
  transactionsByHashMinimal: 'NeonSoup_GetTransactionsByHashMinimal',
  transactionOutputsByHash: 'NeonSoup_GetTransactionOutputsByHash',
  addressTransactions: 'NeonSoup_GetAddressTransactions',
  addressInputTransactions: 'NeonSoup_GetAddressInputTransactions',
  addressOutputTransactions: 'NeonSoup_GetAddressOutputTransactions',
} as const;

export type GraphqlMk2OperationName = (typeof GRAPHQL_MK2_OPERATIONS)[keyof typeof GRAPHQL_MK2_OPERATIONS];

export const GRAPHQL_MK2_QUERIES = {
  openOffers: `query NeonSoup_GetOpenOfferCandidates($limit: Int = 250, $offset: Int = 0, $beaconPolicyId: Hash28Type!) {
  utxos(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 1000}
    order_by: [TX_HASH_ASC, INDEX_ASC]
    where: {_and: [{datumExistsExists: true}, {tokenInOutputs: {_some: {policyId: {_eq: $beaconPolicyId}, quantity: {_eq: "1"}}}}]}
  ) {
    txHash
    index
    address
    value
    datum {
      bytes
    }
    tokens {
      assetId
      policyId
      assetName
      quantity
      asset {
        assetId
        policyId
        assetName
        fingerprint
        decimals
        name
        ticker
        description
      }
    }
  }
}`,
  addressUtxos: `query NeonSoup_GetAddressUtxos($limit: Int = 250, $offset: Int = 0, $address: String!) {
  utxos(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 1000}
    order_by: [TX_HASH_ASC, INDEX_ASC]
    where: {address: {_eq: $address}}
  ) {
    txHash
    index
    value
    tokens {
      assetId
      policyId
      assetName
      quantity
      asset {
        assetId
        policyId
        assetName
        fingerprint
        decimals
        name
        ticker
        description
      }
    }
  }
}`,
  assetsById: `query NeonSoup_GetAssetsById($limit: Int = 100, $offset: Int = 0, $assetIds: [Hex!]) {
  tokenAssets(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 250}
    where: {assetId: {_in: $assetIds}}
  ) {
    assetId
    policyId
    assetName
    fingerprint
    decimals
    name
    ticker
    description
    logo
  }
}`,
  confirmedTransactions: `query NeonSoup_GetConfirmedTransactions($limit: Int = 100, $offset: Int = 0, $txHashes: [Hash32Type!]) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 250}
    where: {hash: {_in: $txHashes}}
  ) {
    hash
    includedAt
  }
}`,
  transactionsByHash: `query NeonSoup_GetTransactionsByHash($limit: Int = 25, $offset: Int = 0, $txHashes: [Hash32Type!]) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 50}
    where: {hash: {_in: $txHashes}}
  ) {
    hash
    includedAt
    fee
    validContract
    inputs {
      address
      value
      sourceTxHash
      sourceTxIndex
      tokens {
        policyId
        assetName
        quantity
      }
    }
    outputs {
      address
      value
      txHash
      index
      datum {
        bytes
      }
      tokens {
        policyId
        assetName
        quantity
      }
    }
  }
}`,
  transactionsByHashNoFee: `query NeonSoup_GetTransactionsByHashNoFee($limit: Int = 25, $offset: Int = 0, $txHashes: [Hash32Type!]) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 50}
    where: {hash: {_in: $txHashes}}
  ) {
    hash
    includedAt
    validContract
    inputs {
      address
      value
      sourceTxHash
      sourceTxIndex
      tokens {
        policyId
        assetName
        quantity
      }
    }
    outputs {
      address
      value
      txHash
      index
      datum {
        bytes
      }
      tokens {
        policyId
        assetName
        quantity
      }
    }
  }
}`,
  transactionOutputsByHash: `query NeonSoup_GetTransactionOutputsByHash($limit: Int = 25, $offset: Int = 0, $txHashes: [Hash32Type!]) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 50}
    where: {hash: {_in: $txHashes}}
  ) {
    hash
    outputs {
      address
      value
      txHash
      index
      datum {
        bytes
      }
      tokens {
        policyId
        assetName
        quantity
      }
    }
  }
}`,
  transactionsByHashMinimal: `query NeonSoup_GetTransactionsByHashMinimal($limit: Int = 25, $offset: Int = 0, $txHashes: [Hash32Type!]) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 50}
    where: {hash: {_in: $txHashes}}
  ) {
    hash
    includedAt
    validContract
    inputs {
      address
      value
      sourceTxHash
      sourceTxIndex
      tokens {
        policyId
        assetName
        quantity
      }
    }
    outputs {
      address
      value
      txHash
      index
      datum {
        bytes
      }
      tokens {
        policyId
        assetName
        quantity
      }
    }
  }
}`,
  addressTransactions: `query NeonSoup_GetAddressTransactions($limit: Int = 50, $offset: Int = 0, $address: String!) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 250}
    order_by: [INCLUDED_AT_DESC]
    where: {_or: [{inputs: {_some: {address: {_eq: $address}}}}, {outputs: {_some: {address: {_eq: $address}}}}]}
  ) {
    hash
  }
}`,
  addressInputTransactions: `query NeonSoup_GetAddressInputTransactions($limit: Int = 50, $offset: Int = 0, $address: String!) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 250}
    order_by: [INCLUDED_AT_DESC]
    where: {inputs: {_some: {address: {_eq: $address}}}}
  ) {
    hash
    includedAt
  }
}`,
  addressOutputTransactions: `query NeonSoup_GetAddressOutputTransactions($limit: Int = 50, $offset: Int = 0, $address: String!) {
  transactions(
    limit: $limit
    offset: $offset
    range: {min: 1, max: 250}
    order_by: [INCLUDED_AT_DESC]
    where: {outputs: {_some: {address: {_eq: $address}}}}
  ) {
    hash
    includedAt
  }
}`,
} as const;
