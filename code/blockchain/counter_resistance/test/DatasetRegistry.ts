import {getSigners} from "./ethers_signers";
import {HardhatEthersSigner, SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

import "@nomicfoundation/hardhat-chai-matchers";
import {EventLog, ZeroAddress} from "ethers";
import {LogDescription} from "ethers/src.ts/abi/interface";
import {NotImplementedError} from "@nomicfoundation/hardhat-ethers/internal/errors"; //Added for revertWithCustomErrors

async function deployDatasetRegistryFixture() {
    const {deployer, contributor, expertContributor, pauser} = await getSigners();
    const DatasetRegistry = await ethers.getContractFactory("DatasetRegistry");

    const datasetRegistry = await upgrades.deployProxy(
        DatasetRegistry.connect(deployer),
        [],
        {initializer: 'initialize'}
    );

    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address);
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address);

    return {datasetRegistry};
}

describe("DatasetRegistry", function () {
    describe("Deployment fixture", function () {
        it("Should assign roles", async function () {
            const {contributor, expertContributor, pauser} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address)).to.equal(true);
        });
    });

    describe("Initialization", function () {
        it("Should initialize with the correct name and symbol", async function () {
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const expectedName = "Dataset Registry";
            const expectedSymbol = "DATA";

            expect(await datasetRegistry.name()).to.equal(expectedName);
            expect(await datasetRegistry.symbol()).to.equal(expectedSymbol);
        });

        it("Should assign roles to the deployer", async function () {
            const {deployer} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            expect(await datasetRegistry.hasRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_UPGRADER_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE(), deployer.address)).to.equal(true);
        });
    });

    describe("Dataset submission", function () {
        it("Should allow an expert contributor to submit a dataset and emit a 'Transfer' event", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            const expectedTokenId = 1;

            const tx = await datasetRegistry.connect(expertContributor).contributeFor(third.address, uri);
            const receipt = await tx.wait();

            const transferLog = receipt.logs.find((log: EventLog) => log.fragment.name === 'Transfer');
            expect(transferLog).not.to.be.undefined;

            const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
            const {from, to, tokenId} = (iface.parseLog(transferLog) as LogDescription).args;

            expect(to).to.equal(third.address);
            expect(from).to.equal(ZeroAddress);
            expect(tokenId).to.equal(1n);
        });

        it("Should allow a contributor to submit their own dataset and emit a 'Transfer' event", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            const expectedTokenId = 1;

            const tx = await datasetRegistry.connect(contributor).contribute(uri);
            const receipt = await tx.wait();

            const transferLog = receipt.logs.find((log: EventLog) => log.fragment.name === 'Transfer');
            expect(transferLog).not.to.be.undefined;

            const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
            const {from, to, tokenId} = (iface.parseLog(transferLog) as LogDescription).args;

            expect(to).to.equal(contributor.address);
            expect(from).to.equal(ZeroAddress);
            expect(tokenId).to.equal(expectedTokenId);
        });

        it("Should not allow an expert contributor to use `submitDataset`", async () => {
            const {expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";

            // Attempt to `contribute` using the expertContributor signer (instead of `contributeFor`)
            const attemptSubmit = datasetRegistry.connect(expertContributor).contribute(uri);

            await expect(attemptSubmit).to.be.revertedWithCustomError(datasetRegistry, "AccessControlUnauthorizedAccount");
        });

        it("Should assign ownership and URI correctly to a contributor", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).contribute(uri);

            const expectedTokenId = 1;

            expect(await datasetRegistry.ownerOf(expectedTokenId)).to.equal(contributor.address);
            expect(await datasetRegistry.contributionURI(expectedTokenId)).to.equal(uri);
        });

        it("Should assign ownership and URI correctly by an expert contributor", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(expertContributor).contributeFor(third, uri);

            const expectedTokenId = 1;

            expect(await datasetRegistry.ownerOf(expectedTokenId)).to.equal(third.address);
            expect(await datasetRegistry.contributionURI(expectedTokenId)).to.equal(uri);
        });

        it("Should reject unauthorized dataset submission", async () => {
            const {third, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await expect(
                datasetRegistry.connect(third).contribute("https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "AccessControlUnauthorizedAccount"
            );

            await expect(
                datasetRegistry.connect(third).contributeFor(third, "https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "AccessControlUnauthorizedAccount"
            );

            await expect(
                datasetRegistry.connect(contributor).contributeFor(contributor, "https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "AccessControlUnauthorizedAccount"
            );
        });
    });

    describe("Dataset URI management", function () {
        it("Should allow a contributor to set the URI for their own dataset", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).contribute(uri);

            const datasetId = 1;
            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(uri);

            const newUri = "https://example.com/new-dataset-uri";

            await expect(datasetRegistry.connect(contributor).setContributionURI(datasetId, newUri))
                .to.emit(datasetRegistry, 'MetadataUpdate')
                .withArgs(datasetId);

            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(newUri);
        });

        it("Should allow an expert contributor to set the URI for any dataset", async () => {
            const {contributor, expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // Submitting a dataset as a regular contributor
            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).contribute(uri);

            const datasetId = 1; // The ID of the dataset submitted by the contributor
            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(uri);

            // An expert contributor updates the URI for the dataset submitted by the contributor
            const newUri = "https://example.com/updated-dataset-uri";

            // Expect the expert contributor to successfully update the dataset URI
            await expect(datasetRegistry.connect(expertContributor).setContributionURI(datasetId, newUri))
                .to.emit(datasetRegistry, 'MetadataUpdate')
                .withArgs(datasetId);

            // Verify the URI was updated successfully
            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(newUri);
        });

        it("Should not allow a contributor to set the URI for another contributor's dataset", async () => {
            const {contributor, expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // An expert contributor submits a dataset on behalf of a third party
            const uri = "https://example.com/dataset-for-third";
            await datasetRegistry.connect(expertContributor).contributeFor(third.address, uri);

            const datasetId = 1; // Assuming this is the dataset ID assigned
            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(uri);

            // A different contributor attempts to update the URI for the dataset owned by 'third'
            const newUri = "https://example.com/unauthorized-update-uri";

            // Expect the attempt to fail due to insufficient permissions
            await expect(datasetRegistry.connect(contributor).setContributionURI(datasetId, newUri))
                .to.be.revertedWith("Not authorized to setContributionURI");

            // Verify the URI was not updated
            expect(await datasetRegistry.contributionURI(datasetId)).to.equal(uri);
        });
    });

    describe("Role management", () => {
        it("Should allow DEFAULT_ADMIN_ROLE to grant CONTRIBUTOR_ROLE", async () => {
            const {deployer, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await datasetRegistry.grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.be.true;
        });

        it("Should prevent non-admins from granting CONTRIBUTOR_ROLE", async () => {
            const {nonContributor, expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await expect(
                datasetRegistry.connect(expertContributor).grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), nonContributor.address)
            ).to.be.revertedWithCustomError(
                datasetRegistry,
                "AccessControlUnauthorizedAccount"
            );

            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), nonContributor.address)).to.be.false;
        });

        it("Should allow DEFAULT_ADMIN_ROLE to revoke CONTRIBUTOR_ROLE", async () => {
            const {deployer, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // First, grant the role, then revoke it
            await datasetRegistry.grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);
            await datasetRegistry.revokeRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.be.false;
        });

        it("Should restrict role revocation to DEFAULT_ADMIN_ROLE", async () => {
            const {deployer, contributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // Grant the role using deployer, then attempt revocation by a non-admin
            await datasetRegistry.grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);
            await expect(
                datasetRegistry.connect(third).revokeRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)
            ).to.be.revertedWithCustomError(
                datasetRegistry,
                "AccessControlUnauthorizedAccount"
            );

            // Verify the role was not revoked
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.equal(true);
        });

        it("Should allow transferring DEFAULT_ADMIN_ROLE", async () => {
            const {deployer, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await datasetRegistry.grantRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), third.address);
            await datasetRegistry.renounceRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), deployer.address);

            // Verify the new admin has the role and the original deployer does not
            expect(await datasetRegistry.hasRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), third.address)).to.be.true;
            expect(await datasetRegistry.hasRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.false;
        });

    });

    describe("Pausing Functionality", () => {
        it("Should pause and prevent dataset submission/manipulation", async function () {
            const {pauser, contributor, expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await datasetRegistry.connect(expertContributor).contributeFor(expertContributor.address, "https://example.com/dataset-1")

            // Pause the contract
            await datasetRegistry.connect(pauser).pause();
            expect(await datasetRegistry.paused()).to.equal(true);

            // Cannot submit a new dataset
            await expect(
                datasetRegistry.connect(expertContributor).contributeFor(expertContributor.address, "https://example.com/dataset-2")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "EnforcedPause"
            );

            // Cannot change dataset URI
            await expect(
                datasetRegistry.connect(expertContributor).setContributionURI(1, "new-uri")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "EnforcedPause"
            );
        });

        it("Should unpause and allow dataset minting", async function () {
            const {pauser, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // Pause
            await datasetRegistry.connect(pauser).pause();
            expect(await datasetRegistry.paused()).to.be.true;

            // Unpause
            await datasetRegistry.connect(pauser).unpause();
            expect(await datasetRegistry.paused()).to.be.false;

            await expect(datasetRegistry.connect(contributor).contribute("https://example.com/dataset"))
                .not.to.be.reverted;
        });

        it("Should restrict pausing functionality to accounts with PAUSER_ROLE", async function () {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await expect(datasetRegistry.connect(third).pause())
                .to.be.revertedWithCustomError(datasetRegistry, "AccessControlUnauthorizedAccount");

            await expect(datasetRegistry.connect(expertContributor).pause())
                .to.be.revertedWithCustomError(datasetRegistry, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Enumerable extension", function () {
        it("Should enumerate datasets", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const expectedTokenIds = [1n, 2n, 3n];

            // Submit some datasets
            for (let i = 0; i < expectedTokenIds.length; i++) {
                await datasetRegistry.connect(contributor).contribute(`testURI#${i}`);
            }

            // Total supply
            expect(await datasetRegistry.totalSupply()).to.equal(expectedTokenIds.length);

            // By owner
            for (let i = 0; i < expectedTokenIds.length; i++) {
                const tokenId = await datasetRegistry.tokenOfOwnerByIndex(contributor.address, i);
                expect(tokenId).to.equal(expectedTokenIds[i]);
            }

            // Owner-agnostic
            for (let i = 0; i < expectedTokenIds.length; i++) {
                const tokenId = await datasetRegistry.tokenByIndex(i);
                expect(tokenId).to.equal(expectedTokenIds[i]);
            }
        });
    });

    describe("Upgradeability", function () {
        it("Should allow contract upgrades by an account with UPGRADER_ROLE");
        it("Should prevent contract upgrades by unauthorized accounts");
    });
});