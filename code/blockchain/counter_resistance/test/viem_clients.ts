import hre from "hardhat";
import type {WalletClient} from "@nomicfoundation/hardhat-viem/types";

export async function getClients(): Promise<{ [key: string]: WalletClient }> {
    const [, deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third]:
        WalletClient[] = await hre.viem.getWalletClients();

    return {deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third};
}
