/**
 * Contract Deployment API
 *
 * Fetches active contract deployments from the backend.
 * Used by frontend to know which factory address & chain to interact with.
 */

import { apiClient } from "./client";

export interface ContractDeploymentConfig {
	id: string;
	chainId: number;
	chainType: "EVM" | "SOLANA";
	chainName: string;
	factoryAddress: string;
	tokenImplementationAddress: string | null;
	bondingCurveImplementationAddress: string | null;
	rpcUrl: string | null;
	explorerUrl: string | null;
	nativeCurrencySymbol: string;
	nativeCurrencyDecimals: number;
	creationFee: string | null;
	isActive: boolean;
	isTestnet: boolean;
	deployedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

interface ContractDeploymentsResponse {
	success: boolean;
	data: ContractDeploymentConfig[];
}

interface SingleContractDeploymentResponse {
	success: boolean;
	data: ContractDeploymentConfig;
}

/**
 * Get all active contract deployments
 */
export async function getActiveContractDeployments(): Promise<
	ContractDeploymentConfig[]
> {
	const { data } = await apiClient.get<ContractDeploymentsResponse>(
		"/api/v1/config/contracts",
	);
	return data.data;
}

/**
 * Get active contract deployment for a specific chain
 */
export async function getContractDeploymentByChainId(
	chainId: number,
): Promise<ContractDeploymentConfig | null> {
	try {
		const { data } =
			await apiClient.get<SingleContractDeploymentResponse>(
				`/api/v1/config/contracts?chainId=${chainId}`,
			);
		return data.data;
	} catch {
		return null;
	}
}
