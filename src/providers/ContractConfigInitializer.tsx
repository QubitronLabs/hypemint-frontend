"use client";

import { useEffect } from "react";
import { useContractConfigStore } from "@/hooks/useContractConfig";

/**
 * Initializes contract deployment config from the backend.
 * Place this component near the root of the app so config is
 * available before any contract interaction hooks run.
 */
export function ContractConfigInitializer({
	children,
}: {
	children: React.ReactNode;
}) {
	const fetch = useContractConfigStore((s) => s.fetch);
	const isLoaded = useContractConfigStore((s) => s.isLoaded);

	useEffect(() => {
		if (!isLoaded) {
			fetch();
		}
	}, [isLoaded, fetch]);

	return <>{children}</>;
}
