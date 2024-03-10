import {getSigners} from "../utils/ethers_signers";

const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

import "@nomicfoundation/hardhat-chai-matchers";

async function deployDatasetRegistryFixture() {
    const {deployer, contributor, expertContributor, pauser, upgrader} = await getSigners();
    const DatasetRegistry = await ethers.getContractFactory("DatasetRegistry");

    const datasetRegistry = await upgrades.deployProxy(
        DatasetRegistry.connect(deployer),
        [],
        {initializer: 'initialize'}
    );

    // Roles assigned during fixture [*]
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address);
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address);
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address);

    return {datasetRegistry};
}

describe("DatasetRegistry", function () {
    describe("Deployment fixture", function () {
        it("Should assign roles", async function () {
            const {contributor, expertContributor, pauser, upgrader} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // [*] See "Roles assigned during fixture"
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address)).to.equal(true);
        });
    });

    describe("Initialization", function () {
        it("Should initialize with the correct name and symbol", async function () {
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const expectedName = "Dataset registry";
            const expectedSymbol = "DATA";

            expect(await datasetRegistry.name()).to.equal(expectedName);
            expect(await datasetRegistry.symbol()).to.equal(expectedSymbol);
        });
    });
});
