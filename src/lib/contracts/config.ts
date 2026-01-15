// Contract ABIs and addresses for HypeMint platform
// Deployed to Polygon Mainnet

export const CONTRACTS = {
  // Polygon Mainnet (chainId: 137) - LIVE
  137: {
    TokenFactory: {
      address: "0x8C9618A7629054377005caEe6D1FF816B4Bee105",
      abi: [
        "function createToken(string name, string symbol, string description, string imageUrl, string twitterUrl, string telegramUrl, string websiteUrl) external payable returns (address tokenAddr, address curveAddr)",
        "function creationFee() external view returns (uint256)",
        "function tokenCount() external view returns (uint256)",
        "function allTokens(uint256) external view returns (address)",
        "function tokenToCurve(address) external view returns (address)",
        "function curveToToken(address) external view returns (address)",
        "function tokenCreator(address) external view returns (address)",
        "function getTokens(uint256 offset, uint256 limit) external view returns (address[])",
        "function getCreatorTokens(address creator) external view returns (address[])",
        "event TokenCreated(address indexed tokenAddress, address indexed curveAddress, address indexed creator, string name, string symbol)",
      ],
    },
  },
  // Polygon Amoy Testnet (chainId: 80002) - for testing
  80002: {
    TokenFactory: {
      address: "", // Not deployed to testnet
      abi: [],
    },
  },
  // Local Hardhat (chainId: 31337)
  31337: {
    TokenFactory: {
      address: "",
      abi: [
        "function createToken(string name, string symbol, string description, string imageUrl, string twitterUrl, string telegramUrl, string websiteUrl) external payable returns (address tokenAddr, address curveAddr)",
        "function creationFee() external view returns (uint256)",
        "function tokenCount() external view returns (uint256)",
        "function getTokens(uint256 offset, uint256 limit) external view returns (address[])",
        "function getCreatorTokens(address creator) external view returns (address[])",
        "event TokenCreated(address indexed tokenAddress, address indexed curveAddress, address indexed creator, string name, string symbol)",
      ],
    },
  },
};

export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
  "function bondingCurve() view returns (address)",
  "function owner() view returns (address)",
  "function description() view returns (string)",
  "function imageUrl() view returns (string)",
  "function twitterUrl() view returns (string)",
  "function telegramUrl() view returns (string)",
  "function websiteUrl() view returns (string)",
  "function graduated() view returns (bool)",
  "function tradingEnabled() view returns (bool)",
  "function getMetadata() view returns (string description, string imageUrl, string twitterUrl, string telegramUrl, string websiteUrl)",
  "function getStatus() view returns (bool graduated, bool tradingEnabled, bool antiBotActive, uint256 launchTime, uint256 totalSupply)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export const BONDING_CURVE_ABI = [
  "function token() view returns (address)",
  "function basePrice() view returns (uint256)",
  "function curveExponent() view returns (uint256)",
  "function reserve() view returns (uint256)",
  "function tradingFee() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function getCurrentPrice() view returns (uint256)",
  "function totalVolume() view returns (uint256)",
  "function buyCount() view returns (uint256)",
  "function sellCount() view returns (uint256)",
  "function uniqueHolderCount() view returns (uint256)",
  "function calculateBuyReturn(uint256 ethAmount, uint256 currentSupply) view returns (uint256)",
  "function calculateSellReturn(uint256 tokenAmount, uint256 currentSupply) view returns (uint256)",
  "function quoteBuy(uint256 ethAmount) view returns (uint256 tokensOut, uint256 fee, uint256 newPrice, uint256 priceImpact)",
  "function quoteSell(uint256 tokenAmount) view returns (uint256 ethOut, uint256 fee, uint256 newPrice, uint256 priceImpact)",
  "function buy(uint256 minTokens) payable",
  "function sell(uint256 tokenAmount, uint256 minEth)",
  "function getAnalytics() view returns (uint256 totalVolume, uint256 buyCount, uint256 sellCount, uint256 uniqueHolders, uint256 reserve, uint256 totalFees, uint256 currentPrice, uint256 marketCap)",
  "function getUserStats(address user) view returns (uint256 balance, uint256 volume, bool holder)",
  "event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 ethAmount, uint256 fee, uint256 newPrice, uint256 newSupply)",
  "event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount, uint256 fee, uint256 newPrice, uint256 newSupply)",
  "event Graduated(uint256 totalSupply, uint256 finalPrice, uint256 liquidityAdded, address liquidityPool)",
];

// Default network configuration
export const DEFAULT_CHAIN_ID = 137; // Polygon Mainnet

// Polygon network configuration
export const POLYGON_CONFIG = {
  chainId: 137,
  chainName: "Polygon Mainnet",
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18,
  },
  rpcUrls: ["https://polygon-rpc.com"],
  blockExplorerUrls: ["https://polygonscan.com"],
};

// Helper to get contract config by chainId
export function getContractConfig(chainId: number) {
  return CONTRACTS[chainId as keyof typeof CONTRACTS] || null;
}
