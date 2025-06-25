export const addressesDevnet = {
  tokensV1: [
    {
      address: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103',
      address_spl: 'F4DgNXqiT3zUQA7dhqN5VzEPkRcd8vtqFwpJSwEEvnz5',
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6
    },
    {
      address: '0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c',
      address_spl: 'So11111111111111111111111111111111111111112',
      name: 'Wrapped SOL',
      symbol: 'wSOL',
      decimals: 9
    }
    /*    {
      address: '0x7a8F86eB7f15111c6bD2BfC57c7616fC12D56284',
      address_spl: `5UMhuc2A58xPAPdtLGuYt7SyEQ1pRnyEGDf1fdzJGe4U`, // ???
      name: 'Token v1',
      symbol: 'v1TOKEN',
      decimals: 9
    },
    {
      address: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
      address_spl: '89dre8rZjLNft7HoupGiyxu3MNftR577ZYu8bHe2kK7g',
      name: 'Wrapped Neon',
      symbol: 'wNEON',
      decimals: 18
    }*/
  ],
  tokensV2: [
    {
      address: '0xD6AE78Fd3E022AC6Bbc0fab385B4CD5924c480f7',
      address_spl: '4MymVAaQos56woWKnwJdBaKB1XTnQ397KE36WYAZ6qV6',
      name: 'USDC (v2 Demo)',
      symbol: 'USDCV2DEMO',
      decimals: 6
    },
    {
      address: '0x165D4788242D98786a1db0dA79953d35702eADEd',
      address_spl: 'ExYuMMxSy5P6Lhbay2TX1BCn5LJRqFnKwW5d6EQpPHS4',
      name: 'wSOL (v2 Demo)',
      symbol: 'wSOLV2DEMO',
      decimals: 9
    }
  ],
  swap: {
    router: '0x9c58018c0599153cDCF5cEA9F1512f58dcFbF7a6',
    factory: '0x2b76CBDfaE4EC1605E510587815d09343378c633',
    pairs: {
      'usdc/wneon': {
        pair: '0x80935329FCC9ace53177F0E91026668EB0c09C7E',
        a: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
        b: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103'
      },
      'wneon/usdc': {
        pair: '0x80935329FCC9ace53177F0E91026668EB0c09C7E',
        a: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
        b: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103'
      },
      'usdc/wsol': {
        pair: '0x5ec7becAB1289302e76f6c06aadc486AfB82Dadf',
        a: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103',
        b: '0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c'
      },
      'wsol/usdc': {
        pair: '0x5ec7becAB1289302e76f6c06aadc486AfB82Dadf',
        a: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103',
        b: '0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c'
      },
      'wneon/v1token': {
        pair: '0xE036225B170611fF55D981db73Db0Fa7BA3dbe31',
        a: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
        b: '0x7a8F86eB7f15111c6bD2BfC57c7616fC12D56284'
      },
      'v1token/wneon': {
        pair: '0xE036225B170611fF55D981db73Db0Fa7BA3dbe31',
        a: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
        b: '0x7a8F86eB7f15111c6bD2BfC57c7616fC12D56284'
      },
      'usdcv2demo/wsolv2demo': {
        pair: '0x1603C9B440dD982393dC23997C39573C3e4Ee4ec',
        a: '0x165D4788242D98786a1db0dA79953d35702eADEd',
        b: '0xD6AE78Fd3E022AC6Bbc0fab385B4CD5924c480f7'
      },
      'wsolv2demo/usdcv2demo': {
        pair: '0x1603C9B440dD982393dC23997C39573C3e4Ee4ec',
        a: '0x165D4788242D98786a1db0dA79953d35702eADEd',
        b: '0xD6AE78Fd3E022AC6Bbc0fab385B4CD5924c480f7'
      }
    }
  },
  transfer: {
    neonTokenTransfer: '0xA4C62831B47C0Bb3a0cF569B7a22A41749a48ED7'
  },
  checkIn: {
    checkIn: '0x70A3e9fE5Ba7C88dFC05317e795a43d149c80793'
  }
};
