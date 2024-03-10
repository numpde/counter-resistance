import {getSigners} from "./utils/ethers_signers";

const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

import "@nomicfoundation/hardhat-chai-matchers";
import {Result, ZeroAddress} from "ethers";

async function deployContractFixture() {
    const {deployer, admin, pauser, contributor, expertContributor} = await getSigners();
    const Contract = await ethers.getContractFactory("ContributionRegistryWithTarget");

    const contract = await upgrades.deployProxy(
        Contract.connect(deployer),
        [],
        {initializer: 'initialize'}
    );

    // Roles assigned during fixture
    await contract.connect(deployer).grantRole(await contract.DEFAULT_ADMIN_ROLE(), admin.address);
    await contract.connect(deployer).grantRole(await contract.CONTRACT_PAUSER_ROLE(), pauser.address);
    await contract.connect(deployer).grantRole(await contract.CONTRIBUTOR_ROLE(), contributor.address);
    await contract.connect(deployer).grantRole(await contract.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address);

    return {contract};
}

describe("DatasetRegistryWithTarget", function () {
    describe("Deployment fixture", function () {
        it("Should assign roles", async function () {
            const {contributor, expertContributor, pauser, upgrader} = await getSigners();
            const {contract} = await deployContractFixture();

            return {contract};
        });
    });

    describe("Initialization", function () {

    });

    describe("Target", function () {
        describe("At contribution", function () {
            it("Should set a target at contribution", async function () {
                const {contributor} = await getSigners();
                const {contract} = await deployContractFixture();

                const uri = "https://example.com/contribution";
                const target = {chainId: 1, contractAddress: ZeroAddress, targetId: 1};

                const f = contract.connect(contributor)["contribute(address,string,(uint256,address,uint256))"];
                await f(contributor.address, uri, target);

                const retrievedTarget: Result = await contract.connect(contributor).getTarget(1);
                expect(retrievedTarget.toObject()).to.deep.equal(target);
            });

            it("Should revert when contributing without a target", async function () {
                const {contributor} = await getSigners();
                const {contract} = await deployContractFixture();

                const uri = "https://example.com/contribution";

                const action = contract.connect(contributor)["contribute(address,string)"](contributor.address, uri);
                await expect(action).to.be.revertedWithCustomError(contract, "TargetRequired");
            });
        });

        describe("Post-contribution", function () {
            it("Should allow an admin to update target for a contribution", async function () {
                const {admin, contributor} = await getSigners();
                const {contract} = await deployContractFixture();

                const uri = "https://example.com/contribution";
                const initialTarget = {chainId: 1, contractAddress: ZeroAddress, targetId: 11};

                // Make an initial contribution with a target
                await contract.connect(contributor)["contribute(address,string,(uint256,address,uint256))"](contributor.address, uri, initialTarget);

                // Define a new target to update the contribution with
                const newTarget = {chainId: 1, contractAddress: ZeroAddress, targetId: 12};

                // Update the target for the contribution, using the admin account
                await expect(contract.connect(admin).setTarget(1, newTarget))
                    .to.emit(contract, 'TargetSet')
                    .withArgs(1);

                // Retrieve the updated target for the contribution
                const retrievedTarget = await contract.connect(contributor).getTarget(1);

                expect(retrievedTarget.toObject()).to.deep.equal(newTarget);
            });

            it("Should revert when a non-admin attempts to update a target", async function () {
                const {contributor} = await getSigners();
                const {contract} = await deployContractFixture();

                const uri = "https://example.com/contribution";
                const initialTarget = {chainId: 1, contractAddress: ZeroAddress, targetId: 11};

                // Contributor makes an initial contribution with a target
                await contract.connect(contributor)["contribute(address,string,(uint256,address,uint256))"](contributor.address, uri, initialTarget);

                // Non-admin user attempts to update the target for the contribution
                await expect(contract.connect(contributor).setTarget(1, initialTarget))
                    .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
            });

            it("Should prevent target operations when the contract is paused", async function () {
                const {admin, contributor, pauser} = await getSigners();
                const {contract} = await deployContractFixture();

                const uri = "https://example.com/contribution";
                const target = {chainId: 1, contractAddress: ZeroAddress, targetId: 11};

                // Admin makes an initial contribution with a target
                await expect(contract.connect(contributor)["contribute(address,string,(uint256,address,uint256))"](contributor.address, uri, target))
                    .to.not.be.reverted;

                // Pause the contract with the admin account
                await contract.connect(pauser).pause();

                const actions = [
                    contract.connect(admin).setTarget(1, target),
                    contract.connect(contributor)["contribute(address,string,(uint256,address,uint256))"](contributor.address, uri, target),
                ]

                for (const action of actions) {
                    await expect(action).to.be.revertedWithCustomError(contract, "EnforcedPause");
                }

                // Attempt to retrieve the target for a contribution
                await expect(contract.connect(contributor).getTarget(1)).not.to.be.reverted;
            });

            it("Should handle attempts to retrieve targets for non-existent contributions gracefully", async function () {
                // Setup: Deploy contract without making any contributions
                // Action: Attempt to retrieve a target for a non-existent contribution ID
                // Expectation: The contract should revert, return a default value, or indicate the absence of the target in a predictable manner
            });
        });
    });
});
