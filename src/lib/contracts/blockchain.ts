import {
  ethers,
  BrowserProvider,
  Contract,
  parseEther,
  formatEther,
} from "ethers";
import { get } from "svelte/store";
import { wallet } from "$lib/stores/wallet";
import {
  CONTRACTS,
  TOKEN_ABI,
  BONDING_CURVE_ABI,
  getContractConfig,
  POLYGON_CONFIG,
  DEFAULT_CHAIN_ID,
} from "./config";

export interface TokenCreationParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
}

export interface TokenInfo {
  tokenAddress: string;
  curveAddress: string;
  creator: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  websiteUrl: string;
  totalSupply: string;
  currentPrice: string;
  marketCap: string;
  graduated: boolean;
  tradingEnabled: boolean;
}

export interface TradeQuote {
  tokensOut?: string;
  ethOut?: string;
  fee: string;
  newPrice: string;
  priceImpact: number;
}

export interface CurveAnalytics {
  totalVolume: string;
  buyCount: number;
  sellCount: number;
  uniqueHolders: number;
  reserve: string;
  totalFees: string;
  currentPrice: string;
  marketCap: string;
}

class BlockchainService {
  private getProvider(): BrowserProvider | null {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return new BrowserProvider(window.ethereum);
  }

  private async getSigner() {
    const provider = this.getProvider();
    if (!provider) throw new Error("No wallet provider found");
    return provider.getSigner();
  }

  private getFactoryContract(chainId: number = DEFAULT_CHAIN_ID) {
    const config = getContractConfig(chainId);
    if (!config?.TokenFactory?.address) {
      throw new Error(`TokenFactory not deployed on chain ${chainId}`);
    }
    return {
      address: config.TokenFactory.address,
      abi: config.TokenFactory.abi,
    };
  }

  // Check if connected to Polygon
  async isPolygonNetwork(): Promise<boolean> {
    const provider = this.getProvider();
    if (!provider) return false;
    const network = await provider.getNetwork();
    return Number(network.chainId) === 137;
  }

  // Switch to Polygon network
  async switchToPolygon(): Promise<void> {
    if (!window.ethereum) throw new Error("No wallet found");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x89" }], // 137 in hex
      });
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x89",
              chainName: POLYGON_CONFIG.chainName,
              nativeCurrency: POLYGON_CONFIG.nativeCurrency,
              rpcUrls: POLYGON_CONFIG.rpcUrls,
              blockExplorerUrls: POLYGON_CONFIG.blockExplorerUrls,
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  // Get creation fee
  async getCreationFee(): Promise<string> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const config = this.getFactoryContract();
    const contract = new Contract(config.address, config.abi, provider);
    const fee = await contract.creationFee();
    return formatEther(fee);
  }

  // Create a new token
  async createToken(params: TokenCreationParams): Promise<{
    tokenAddress: string;
    curveAddress: string;
    txHash: string;
  }> {
    // Ensure we're on Polygon
    if (!(await this.isPolygonNetwork())) {
      await this.switchToPolygon();
    }

    const signer = await this.getSigner();
    const config = this.getFactoryContract();
    const contract = new Contract(config.address, config.abi, signer);

    // Get creation fee
    const creationFee = await contract.creationFee();

    // Create token
    const tx = await contract.createToken(
      params.name,
      params.symbol,
      params.description || "",
      params.imageUrl || "",
      params.twitterUrl || "",
      params.telegramUrl || "",
      params.websiteUrl || "",
      { value: creationFee }
    );

    const receipt = await tx.wait();

    // Parse TokenCreated event
    const iface = new ethers.Interface(config.abi);
    const event = receipt.logs
      .map((log: any) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "TokenCreated");

    if (!event) throw new Error("Token creation event not found");

    return {
      tokenAddress: event.args.tokenAddress,
      curveAddress: event.args.curveAddress,
      txHash: receipt.hash,
    };
  }

  // Get all tokens with pagination
  async getTokens(offset: number = 0, limit: number = 20): Promise<string[]> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const config = this.getFactoryContract();
    const contract = new Contract(config.address, config.abi, provider);

    return contract.getTokens(offset, limit);
  }

  // Get token info by address
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const config = this.getFactoryContract();
    const factory = new Contract(config.address, config.abi, provider);
    const token = new Contract(tokenAddress, TOKEN_ABI, provider);

    // Get curve address from factory
    const curveAddress = await factory.tokenToCurve(tokenAddress);
    const creator = await factory.tokenCreator(tokenAddress);

    // Get token details
    const [name, symbol, totalSupply, graduated, tradingEnabled] =
      await Promise.all([
        token.name(),
        token.symbol(),
        token.totalSupply(),
        token.graduated().catch(() => false),
        token.tradingEnabled().catch(() => true),
      ]);

    // Get metadata
    let metadata: any = {
      description: "",
      imageUrl: "",
      twitterUrl: "",
      telegramUrl: "",
      websiteUrl: "",
    };
    try {
      const [description, imageUrl, twitterUrl, telegramUrl, websiteUrl] =
        await token.getMetadata();
      metadata = { description, imageUrl, twitterUrl, telegramUrl, websiteUrl };
    } catch {
      // Fallback to individual calls
      try {
        metadata.description = await token.description();
        metadata.imageUrl = await token.imageUrl();
        metadata.twitterUrl = await token.twitterUrl();
        metadata.telegramUrl = await token.telegramUrl();
        metadata.websiteUrl = await token.websiteUrl();
      } catch {}
    }

    // Get price and market cap from curve
    let currentPrice = "0";
    let marketCap = "0";

    if (curveAddress && curveAddress !== ethers.ZeroAddress) {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
      try {
        const price = await curve.getCurrentPrice();
        currentPrice = formatEther(price);

        const analytics = await curve.getAnalytics();
        marketCap = formatEther(analytics[7]); // marketCap is at index 7
      } catch {}
    }

    return {
      tokenAddress,
      curveAddress,
      creator,
      name,
      symbol,
      description: metadata.description,
      imageUrl: metadata.imageUrl,
      twitterUrl: metadata.twitterUrl,
      telegramUrl: metadata.telegramUrl,
      websiteUrl: metadata.websiteUrl,
      totalSupply: formatEther(totalSupply),
      currentPrice,
      marketCap,
      graduated,
      tradingEnabled,
    };
  }

  // Get buy quote
  async getBuyQuote(
    curveAddress: string,
    ethAmount: string
  ): Promise<TradeQuote> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    const amount = parseEther(ethAmount);

    const [tokensOut, fee, newPrice, priceImpact] = await contract.quoteBuy(
      amount
    );

    return {
      tokensOut: formatEther(tokensOut),
      fee: formatEther(fee),
      newPrice: formatEther(newPrice),
      priceImpact: Number(priceImpact) / 100, // Convert basis points to percentage
    };
  }

  // Get sell quote
  async getSellQuote(
    curveAddress: string,
    tokenAmount: string
  ): Promise<TradeQuote> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    const amount = parseEther(tokenAmount);

    const [ethOut, fee, newPrice, priceImpact] = await contract.quoteSell(
      amount
    );

    return {
      ethOut: formatEther(ethOut),
      fee: formatEther(fee),
      newPrice: formatEther(newPrice),
      priceImpact: Number(priceImpact) / 100,
    };
  }

  // Buy tokens
  async buyTokens(
    curveAddress: string,
    ethAmount: string,
    minTokens: string = "0"
  ): Promise<string> {
    if (!(await this.isPolygonNetwork())) {
      await this.switchToPolygon();
    }

    const signer = await this.getSigner();
    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, signer);

    const tx = await contract.buy(parseEther(minTokens), {
      value: parseEther(ethAmount),
    });

    const receipt = await tx.wait();
    return receipt.hash;
  }

  // Sell tokens
  async sellTokens(
    tokenAddress: string,
    curveAddress: string,
    tokenAmount: string,
    minEthOut: string = "0"
  ): Promise<string> {
    if (!(await this.isPolygonNetwork())) {
      await this.switchToPolygon();
    }

    const signer = await this.getSigner();

    // First approve
    const tokenContract = new Contract(tokenAddress, TOKEN_ABI, signer);
    const amount = parseEther(tokenAmount);

    const allowance = await tokenContract.allowance(
      await signer.getAddress(),
      curveAddress
    );
    if (allowance < amount) {
      const approveTx = await tokenContract.approve(curveAddress, amount);
      await approveTx.wait();
    }

    // Then sell
    const curveContract = new Contract(curveAddress, BONDING_CURVE_ABI, signer);
    const tx = await curveContract.sell(amount, parseEther(minEthOut));

    const receipt = await tx.wait();
    return receipt.hash;
  }

  // Get token balance
  async getTokenBalance(
    tokenAddress: string,
    userAddress: string
  ): Promise<string> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(tokenAddress, TOKEN_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    return formatEther(balance);
  }

  // Get all tokens created by user
  async getCreatorTokens(creatorAddress: string): Promise<string[]> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const config = this.getFactoryContract();
    const contract = new Contract(config.address, config.abi, provider);

    return contract.getCreatorTokens(creatorAddress);
  }

  // Get total token count
  async getTokenCount(): Promise<number> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const config = this.getFactoryContract();
    const contract = new Contract(config.address, config.abi, provider);

    const count = await contract.tokenCount();
    return Number(count);
  }

  // Get curve analytics
  async getCurveAnalytics(curveAddress: string): Promise<CurveAnalytics> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    const [
      totalVolume,
      buyCount,
      sellCount,
      uniqueHolders,
      reserve,
      totalFees,
      currentPrice,
      marketCap,
    ] = await contract.getAnalytics();

    return {
      totalVolume: formatEther(totalVolume),
      buyCount: Number(buyCount),
      sellCount: Number(sellCount),
      uniqueHolders: Number(uniqueHolders),
      reserve: formatEther(reserve),
      totalFees: formatEther(totalFees),
      currentPrice: formatEther(currentPrice),
      marketCap: formatEther(marketCap),
    };
  }

  // Get user stats for a curve
  async getUserStats(
    curveAddress: string,
    userAddress: string
  ): Promise<{
    balance: string;
    volume: string;
    isHolder: boolean;
  }> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    const [balance, volume, holder] = await contract.getUserStats(userAddress);

    return {
      balance: formatEther(balance),
      volume: formatEther(volume),
      isHolder: holder,
    };
  }

  // Check if token is graduated
  async isGraduated(curveAddress: string): Promise<boolean> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    return contract.graduated();
  }

  // Get current price
  async getCurrentPrice(curveAddress: string): Promise<string> {
    const provider = this.getProvider();
    if (!provider) throw new Error("No provider");

    const contract = new Contract(curveAddress, BONDING_CURVE_ABI, provider);
    const price = await contract.getCurrentPrice();
    return formatEther(price);
  }
}

export const blockchain = new BlockchainService();
