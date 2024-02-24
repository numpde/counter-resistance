import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

export async function getSigners(): Promise<{ [key: string]: SignerWithAddress }> {
    const [
        ,
        deployer, admin, upgrader, pauser, paymaster, manager, contributor, expertContributor, nonContributor, third
    ]
        : SignerWithAddress[]
        = await ethers.getSigners();

    return {
        deployer, admin, upgrader, pauser, paymaster, manager, contributor, expertContributor, nonContributor, third
    };
}
