import {getSigners} from "../utils/ethers_signers";

const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

import "@nomicfoundation/hardhat-chai-matchers";
import {EventLog, ZeroAddress} from "ethers";
import {LogDescription} from "ethers/src.ts/abi/interface";
import {NotImplementedError} from "@nomicfoundation/hardhat-ethers/internal/errors";
import {experimentalAddHardhatNetworkMessageTraceHook} from "hardhat/config"; //Added for revertWithCustomErrors

async function deployDatasetRegistryFixture() {
    const {deployer, contributor, expertContributor, pauser, upgrader} = await getSigners();
    const DatasetRegistry = await ethers.getContractFactory("DatasetRegistry");

    const datasetRegistry = await upgrades.deployProxy(
        DatasetRegistry.connect(deployer),
        [],
        {initializer: 'initialize'}
    );

    // Roles assigned during fixture [*]
    await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address);
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
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), pauser.address)).to.equal(true);
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

        it("Should assign roles to the deployer", async function () {
            const {deployer} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            expect(await datasetRegistry.hasRole(await datasetRegistry.DEFAULT_ADMIN_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_PAUSER_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRACT_UPGRADER_ROLE(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE_MANAGER(), deployer.address)).to.equal(true);
            expect(await datasetRegistry.hasRole(await datasetRegistry.EXPERT_CONTRIBUTOR_ROLE_MANAGER(), deployer.address)).to.equal(true);
        });
    });

    describe("Upgradeability", function () {
        it("Should allow contract upgrades by an account with UPGRADER_ROLE", async () => {
            const {deployer, contributor, upgrader} = await getSigners();

            // Deploy the initial version of the DatasetRegistry contract with the deployer account
            const DatasetRegistry = await ethers.getContractFactory("ContributionRegistry", deployer);
            const datasetRegistry = await upgrades.deployProxy(DatasetRegistry, {kind: 'uups'});

            // Grant the upgrader role to upgrader
            await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address);
            // Grant the contributor role to contributor
            await datasetRegistry.connect(deployer).grantRole(await datasetRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            // Prepare the same contract as a new version for the upgrade
            // This demonstrates the upgrade mechanism rather than functionality change
            const DatasetRegistryUpdated = await ethers.getContractFactory("DatasetRegistry", upgrader);

            // Attempt to upgrade the contract with the upgrader account
            const datasetRegistryUpdated = await upgrades.upgradeProxy(datasetRegistry, DatasetRegistryUpdated);

            const hasSubmit = ((fragment: any) => ((fragment.name === 'submit') && (fragment.type === 'function')));

            // Before the upgrade, there is not function `submit`; after the upgrade, there is.
            expect(datasetRegistry.interface.fragments.some(hasSubmit)).to.be.false;
            expect(datasetRegistryUpdated.interface.fragments.some(hasSubmit)).to.be.true;
        });

        it("Should prevent contract upgrades by unauthorized accounts", async () => {
            const {deployer, third} = await getSigners();

            // Deploy the initial version of the ContributionRegistry contract with the deployer account
            const ContributionRegistry = await ethers.getContractFactory("ContributionRegistry", deployer);
            const contributionRegistry = await upgrades.deployProxy(ContributionRegistry, {kind: 'uups'});

            // Prepare the same contract as a new version for the "upgrade"
            // This is to demonstrate the upgrade mechanism, not functionality change
            const ContributionRegistryUpdated = await ethers.getContractFactory("ContributionRegistry", third);

            // Attempt to upgrade the contract with an unauthorized account
            // This should fail due to lack of permissions
            const action = upgrades.upgradeProxy(contributionRegistry, ContributionRegistryUpdated, {from: third.address});
            await expect(action).to.be.revertedWithCustomError(contributionRegistry, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Dataset submission", function () {
        it("Should allow an expert contributor to submit a dataset and emit a 'Contribution' event", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            const expectedTokenId = 1;

            const tx = await datasetRegistry.connect(expertContributor).submitFor(third.address, uri);
            const receipt = await tx.wait();

            const transferLog = receipt.logs.find((log: EventLog) => (log.fragment.name === 'Contribution'));
            expect(transferLog).not.to.be.undefined;

            const iface = new ethers.Interface(["event Contribution(address indexed by, address indexed to, uint256 indexed contributionId, string uri)"]);
            const {by, to, contributionId} = (iface.parseLog(transferLog) as LogDescription).args;

            expect(by).to.equal(expertContributor.address);
            expect(to).to.equal(third.address);
            expect(contributionId).to.equal(1n);
        });

        it("Should allow a contributor to submit their own dataset and emit a 'Transfer' event", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            const expectedTokenId = 1;

            const tx = await datasetRegistry.connect(contributor).submit(uri);
            const receipt = await tx.wait();

            const transferLog = receipt.logs.find((log: EventLog) => log.fragment.name === 'Transfer');
            expect(transferLog).not.to.be.undefined;

            const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
            const {from, to, tokenId} = (iface.parseLog(transferLog) as LogDescription).args;

            expect(to).to.equal(contributor.address);
            expect(from).to.equal(ZeroAddress);
            expect(tokenId).to.equal(expectedTokenId);
        });

        it("Should allow also an expert contributor to contribute", async () => {
            const {deployer, expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // First, remove the "contributor" role
            await datasetRegistry.connect(deployer).revokeRole(await datasetRegistry.CONTRIBUTOR_ROLE(), expertContributor.address);
            expect(await datasetRegistry.hasRole(await datasetRegistry.CONTRIBUTOR_ROLE(), expertContributor.address)).to.be.false;

            const uri = "https://example.com/dataset";

            const attemptSubmit = datasetRegistry.connect(expertContributor).submit(uri);
            await expect(attemptSubmit).to.not.be.reverted;
        });

        it("Should assign ownership and URI correctly to a contributor", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).submit(uri);

            const expectedTokenId = 1;

            expect(await datasetRegistry.ownerOf(expectedTokenId)).to.equal(contributor.address);
            expect(await datasetRegistry.metadata(expectedTokenId)).to.equal(uri);
        });

        it("Should assign ownership and URI correctly by an expert contributor", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(expertContributor).submitFor(third, uri);

            const expectedTokenId = 1;

            expect(await datasetRegistry.ownerOf(expectedTokenId)).to.equal(third.address);
            expect(await datasetRegistry.metadata(expectedTokenId)).to.equal(uri);
        });

        it("Should reject unauthorized dataset submission", async () => {
            const {third, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await expect(
                datasetRegistry.connect(third).submit("https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "NotContributor"
            );

            await expect(
                datasetRegistry.connect(third).submitFor(third, "https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "NotContributor"
            );

            await expect(
                datasetRegistry.connect(contributor).submitFor(third, "https://example.com/illicit-dataset")
            ).to.be.revertedWithCustomError(
                datasetRegistry, "CannotContributeForOthers"
            );
        });
    });

    describe("Dataset URI management", function () {
        it("Should allow a contributor to set the URI for their own dataset", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).submit(uri);

            const datasetId = 1;
            expect(await datasetRegistry.metadata(datasetId)).to.equal(uri);

            const newUri = "https://example.com/new-dataset-uri";

            await expect(datasetRegistry.connect(contributor).setMetadata(datasetId, newUri))
                .to.emit(datasetRegistry, 'MetadataUpdate')
                .withArgs(datasetId);

            expect(await datasetRegistry.metadata(datasetId)).to.equal(newUri);
        });

        it("Should not allow an expert contributor to set the URI for any dataset", async () => {
            const {contributor, expertContributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // Submitting a dataset as a regular contributor
            const uri = "https://example.com/dataset";
            await datasetRegistry.connect(contributor).submit(uri);

            const datasetId = 1; // The ID of the dataset submitted by the contributor
            expect(await datasetRegistry.metadata(datasetId)).to.equal(uri);

            // An expert contributor attempts to update the URI for the dataset submitted by the contributor
            const newUri = "https://example.com/updated-dataset-uri";

            await expect(datasetRegistry.connect(expertContributor).setMetadata(datasetId, newUri))
                .to.revertedWithCustomError(
                    datasetRegistry,
                    "NotAuthorizedToUpdateMetadata"
                )
            // .to.emit(datasetRegistry, 'MetadataUpdate')
            // .withArgs(datasetId);

            // Verify the URI was not updated
            expect(await datasetRegistry.metadata(datasetId)).to.equal(uri);
        });

        it("Should not allow a contributor to set the URI for another contributor's dataset", async () => {
            const {contributor, expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            // An expert contributor submits a dataset on behalf of a third party
            const uri = "https://example.com/dataset-for-third";
            await datasetRegistry.connect(expertContributor).submitFor(third.address, uri);

            const datasetId = 1; // Assuming this is the dataset ID assigned
            expect(await datasetRegistry.metadata(datasetId)).to.equal(uri);

            // A different contributor attempts to update the URI for the dataset owned by 'third'
            const newUri = "https://example.com/unauthorized-update-uri";

            // Expect the attempt to fail due to insufficient permissions
            await expect(datasetRegistry.connect(contributor).setMetadata(datasetId, newUri))
                .to.revertedWithCustomError(
                    datasetRegistry,
                    "NotAuthorizedToUpdateMetadata"
                )

            // Verify the URI was not updated
            expect(await datasetRegistry.metadata(datasetId)).to.equal(uri);
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

            await datasetRegistry.connect(expertContributor).submit("https://example.com/dataset-1")

            // Pause the contract
            await datasetRegistry.connect(pauser).pause();
            expect(await datasetRegistry.paused()).to.equal(true);

            const actions = [
                datasetRegistry.connect(expertContributor).submit("https://example.com/dataset-2"),
                datasetRegistry.connect(expertContributor).setMetadata(1, "new-uri"),
            ];

            for (const action of actions) {
                await expect(action).revertedWithCustomError(datasetRegistry, "EnforcedPause");
            }
        });

        it("Should unpause and allow dataset minting", async function () {
            const {pauser, contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            await datasetRegistry.connect(pauser).pause();
            expect(await datasetRegistry.paused()).to.be.true;

            await datasetRegistry.connect(pauser).unpause();
            expect(await datasetRegistry.paused()).to.be.false;

            const action = datasetRegistry.connect(contributor).submit("https://example.com/dataset");
            await expect(action).not.to.be.reverted;
        });

        it("Should restrict pausing functionality to accounts with PAUSER_ROLE", async function () {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();


            const actions = [
                datasetRegistry.connect(third).pause(),
                datasetRegistry.connect(expertContributor).pause(),
            ];

            for (const action of actions) {
                await expect(action).revertedWithCustomError(datasetRegistry, "AccessControlUnauthorizedAccount");
            }
        });
    });

    describe("Enumerable extension", function () {
        it("Should enumerate datasets", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const expectedTokenIds = [1n, 2n, 3n];

            // Submit some datasets
            for (let i = 0; i < expectedTokenIds.length; i++) {
                await datasetRegistry.connect(contributor).submit(`testURI#${i}`);
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

    describe("Tracking of the original contributor", function () {
        it("Should record the submitter as the original contributor when a dataset is submitted directly", async () => {
            const {contributor} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();
            const uri = "https://example.com/direct-submission";

            await datasetRegistry.connect(contributor).submit(uri);
            const datasetId = 1; // Assuming this is the dataset ID assigned

            const originalContributor = await datasetRegistry.getOriginalContributor(datasetId);
            expect(originalContributor).to.equal(contributor.address);
        });

        it("Should record the specified contributor as the original contributor when submitted on behalf", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/submission-on-behalf";

            await datasetRegistry.connect(expertContributor).submitFor(third.address, uri);
            const datasetId = 1; // Assuming this is the dataset ID assigned

            const originalContributor = await datasetRegistry.getOriginalContributor(datasetId);
            expect(originalContributor).to.equal(expertContributor.address);
        });

        it("Should keep the original contributor unchanged after ownership transfer", async () => {
            const {expertContributor, third} = await getSigners();
            const {datasetRegistry} = await deployDatasetRegistryFixture();

            const uri = "https://example.com/ownership-transfer";
            await datasetRegistry.connect(expertContributor).submit(uri);

            const datasetId = 1; // Assuming this is the dataset ID assigned

            // Assuming the expertContributor can transfer ownership of own NFT
            await datasetRegistry.connect(expertContributor).safeTransferFrom(expertContributor.address, third.address, datasetId);

            const originalContributor = await datasetRegistry.getOriginalContributor(datasetId);
            expect(originalContributor).to.equal(expertContributor.address);
        });
    });

    describe("NFT Transfer Authorization", function () {
        describe("Transfer by Expert Contributors", function () {
            it("Should allow an expert contributor to transfer their own NFT", async () => {
                const {expertContributor, third} = await getSigners();
                const {datasetRegistry} = await deployDatasetRegistryFixture();

                // An expert contributor submits a dataset and receives an NFT
                const uri = "https://example.com/expert-dataset";
                await datasetRegistry.connect(expertContributor).submit(uri);

                const datasetId = 1; // Assuming this is the first dataset and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the expert contributor
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(expertContributor.address);

                // Attempt to transfer NFT from expert contributor to recipient
                await datasetRegistry.connect(expertContributor).safeTransferFrom(expertContributor.address, third.address, datasetId);

                // Verify the new owner of the NFT is the recipient
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(third.address);
            });

            it("Should not allow a regular contributor to transfer NFTs, even their own", async () => {
                const {contributor: regularContributor, third: recipient} = await getSigners();
                const {datasetRegistry} = await deployDatasetRegistryFixture();

                // A regular contributor submits a dataset and receives an NFT
                const uri = "https://example.com/regular-contributor-dataset";
                await datasetRegistry.connect(regularContributor).submit(uri);

                const datasetId = 1; // Assuming this is the first dataset and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the regular contributor
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(regularContributor.address);

                // Attempt to transfer NFT from regular contributor to recipient
                // Expect the attempt to fail due to restrictions on transfer by regular contributors
                const action = datasetRegistry.connect(regularContributor).safeTransferFrom(regularContributor.address, recipient.address, datasetId);
                await expect(action).to.be.revertedWithCustomError(datasetRegistry, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(regularContributor.address);
            });
        });

        describe("Transfer Attempt by Non-owners", function () {
            it("Should not allow third party to transfer", async () => {
                const {expertContributor, third} = await getSigners();
                const {datasetRegistry} = await deployDatasetRegistryFixture();

                // An expert contributor submits a dataset and receives an NFT
                const uri = "https://example.com/expert-dataset";
                await datasetRegistry.connect(expertContributor).submit(uri);

                const datasetId = 1; // Assuming this is the first dataset and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the expert contributor
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(expertContributor.address);

                // Attempt to transfer NFT from a non-owner third party account
                // Expect the attempt to fail due to the third party not owning the NFT
                const action = datasetRegistry.connect(third).safeTransferFrom(expertContributor.address, third.address, datasetId);
                await expect(action).to.be.revertedWithCustomError(datasetRegistry, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(expertContributor.address);
            });

            it("Should not allow non-owner to transfer, even the original contributor", async () => {
                const {expertContributor, third} = await getSigners();
                const {datasetRegistry} = await deployDatasetRegistryFixture();

                // An expert contributor submits a dataset on behalf of a third party
                const uri = "https://example.com/expert-dataset";
                await datasetRegistry.connect(expertContributor).submitFor(third.address, uri);

                const datasetId = 1; // Assuming this is the first dataset and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the third party
                // but the original contributor is the expertContributor
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(third.address);
                expect(await datasetRegistry.getOriginalContributor(datasetId)).to.equal(expertContributor.address);

                // The expert contributor, who is not the current owner, attempts to transfer the NFT back to themselves
                const action = datasetRegistry.connect(expertContributor).safeTransferFrom(third.address, expertContributor.address, datasetId);

                // Expect the attempt to fail due to the expert contributor not having ownership or approval
                await expect(action).to.be.revertedWithCustomError(datasetRegistry, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed and remains with the third party
                expect(await datasetRegistry.ownerOf(datasetId)).to.equal(third.address);
            });
        });

        describe("Transfer Attempt with Delegated Authority", function () {
            it("Should not allow expert contributors to delegate transfer authority", async () => {
                // Setup: Deploy contracts, mint NFT to expert contributor, try to delegate transfer to another expert contributor
                // Action: Attempt to transfer NFT using `safeTransferFrom` by the delegated expert contributor
                // Expectation: Transfer fails
                throw new Error("Test not implemented");
            });

            it("Should not allow regular contributors to delegate transfer authority", async () => {
                // Setup: Deploy contracts, mint NFT to regular contributor, try to delegate transfer to another regular contributor
                // Action: Attempt to transfer NFT using `safeTransferFrom` by the delegated regular contributor
                // Expectation: Transfer fails
                throw new Error("Test not implemented");
            });
        });

        describe("Invalid Transfer Scenarios", function () {
            it("Should fail transfer if the token ID does not exist", async () => {
                // Setup: Deploy contracts without minting any NFT
                // Action: Attempt to transfer NFT using `safeTransferFrom` with a non-existent token ID
                // Expectation: Transfer fails due to non-existent token ID
                throw new Error("Test not implemented");
            });

            it("Should fail transfer if the spender is not the owner nor the original contributor", async () => {
                // Setup: Deploy contracts, mint NFT to one account, another unrelated account attempts transfer
                // Action: Attempt to transfer NFT using `safeTransferFrom` by an unrelated account
                // Expectation: Transfer fails due to lack of ownership or original contribution
                throw new Error("Test not implemented");
            });
        });
    });
});
