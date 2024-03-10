import {getSigners} from "./utils/ethers_signers";

const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

import "@nomicfoundation/hardhat-chai-matchers";
import {EventLog, ZeroAddress} from "ethers";
import {LogDescription} from "ethers/src.ts/abi/interface";

async function deployContributionRegistryFixture() {
    const {deployer, admin, contributor, expertContributor, pauser, upgrader} = await getSigners();
    const ContributionRegistry = await ethers.getContractFactory("ContributionRegistry");

    const contributionRegistry = await upgrades.deployProxy(
        ContributionRegistry.connect(deployer),
        [],
        {initializer: 'initialize'}
    );

    // Roles assigned during fixture [*]
    await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), admin.address);
    await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address);
    await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address);
    await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.CONTRACT_PAUSER_ROLE(), pauser.address);
    await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address);

    return {contributionRegistry};
}

describe("ContributionRegistry", function () {
    describe("Deployment fixture", function () {
        it("Should assign roles", async function () {
            const {admin, contributor, expertContributor, pauser, upgrader} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            // [*] See "Roles assigned during fixture"
            expect(await contributionRegistry.hasRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.equal(true);
            expect(await contributionRegistry.hasRole(await contributionRegistry.EXPERT_CONTRIBUTOR_ROLE(), expertContributor.address)).to.equal(true);
            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRACT_PAUSER_ROLE(), pauser.address)).to.equal(true);
            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address)).to.equal(true);
        });
    });

    describe("Initialization", function () {
        it("Should initialize with the correct name and symbol", async function () {
            const {contributionRegistry} = await deployContributionRegistryFixture();

            const expectedName = "Contribution registry";
            const expectedSymbol = "CORE";

            expect(await contributionRegistry.name()).to.equal(expectedName);
            expect(await contributionRegistry.symbol()).to.equal(expectedSymbol);
        });

        it("Should assign roles to the deployer", async function () {
            const {deployer} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            const roles = [
                'DEFAULT_ADMIN_ROLE',
                'CONTRACT_PAUSER_ROLE',
                'CONTRACT_UPGRADER_ROLE',
                'CONTRIBUTOR_ROLE_MANAGER',
                'EXPERT_CONTRIBUTOR_ROLE_MANAGER',
            ];

            for (const roleName of roles) {
                const role = await contributionRegistry[roleName]();
                expect(await contributionRegistry.hasRole(role, deployer.address)).to.equal(true);
            }
        });
    });

    describe("Upgradeability", function () {
        it("Should allow contract upgrades by an account with UPGRADER_ROLE", async () => {
            const {deployer, contributor, upgrader} = await getSigners();

            // Deploy the initial version of the DatasetRegistry contract with the deployer account
            const ContributionRegistry = await ethers.getContractFactory("ContributionRegistry", deployer);
            const contributionRegistry = await upgrades.deployProxy(ContributionRegistry, {kind: 'uups'});

            // Grant the upgrader role to upgrader
            await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.CONTRACT_UPGRADER_ROLE(), upgrader.address);
            // Grant the contributor role to contributor
            await contributionRegistry.connect(deployer).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            // Prepare the same contract as a new version for the upgrade
            // This demonstrates the upgrade mechanism rather than functionality change
            const DatasetRegistry = await ethers.getContractFactory("DatasetRegistry", upgrader);

            // Attempt to upgrade the contract with the upgrader account
            const datasetRegistry = await upgrades.upgradeProxy(contributionRegistry, DatasetRegistry);

            const isSubmit = ((fragment: any) => ((fragment.name === 'submit') && (fragment.type === 'function')));

            // Before the upgrade, there is not function `submit`; after the upgrade, there is.
            expect(contributionRegistry.interface.fragments.some(isSubmit)).to.be.false;
            expect(datasetRegistry.interface.fragments.some(isSubmit)).to.be.true;
        });

        it("Should prevent contract upgrades by unauthorized accounts", async () => {
            const {deployer, third} = await getSigners();

            // Deploy the initial version of the ContributionRegistry contract with the deployer account
            const ContributionRegistry = await ethers.getContractFactory("ContributionRegistry", deployer);
            const contributionRegistry = await upgrades.deployProxy(ContributionRegistry, {kind: 'uups'});

            // Prepare the same contract as a new version for the "upgrade"
            // This is to demonstrate the upgrade mechanism, not functionality change
            const DatasetRegistry = await ethers.getContractFactory("DatasetRegistry", third);

            // Attempt to upgrade the contract with an unauthorized account
            // This should fail due to lack of permissions
            const action = upgrades.upgradeProxy(contributionRegistry, DatasetRegistry, {from: third.address});
            await expect(action).to.be.revertedWithCustomError(contributionRegistry, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Role management", () => {
        it("Should allow DEFAULT_ADMIN_ROLE to grant CONTRIBUTOR_ROLE", async () => {
            const {contributor, admin} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            await contributionRegistry.connect(admin).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.be.true;
        });

        it("Should prevent non-admins from granting CONTRIBUTOR_ROLE", async () => {
            const {nonContributor, expertContributor} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            await expect(
                contributionRegistry.connect(expertContributor).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), nonContributor.address)
            ).to.be.revertedWithCustomError(
                contributionRegistry,
                "AccessControlUnauthorizedAccount"
            );

            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRIBUTOR_ROLE(), nonContributor.address)).to.be.false;
        });

        it("Should allow DEFAULT_ADMIN_ROLE to revoke CONTRIBUTOR_ROLE", async () => {
            const {admin, contributor} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            // First, grant the role, then revoke it
            await contributionRegistry.connect(admin).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address);
            await contributionRegistry.connect(admin).revokeRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address);

            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRIBUTOR_ROLE(), contributor.address)).to.be.false;
        });

        it("Should restrict role revocation to DEFAULT_ADMIN_ROLE", async () => {
            const {admin, nonContributor, third} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            // Grant the role, then attempt revocation by a non-admin
            await contributionRegistry.connect(admin).grantRole(await contributionRegistry.CONTRIBUTOR_ROLE(), nonContributor.address);

            const action = contributionRegistry.connect(third).revokeRole(await contributionRegistry.CONTRIBUTOR_ROLE(), nonContributor.address);
            await expect(action).to.be.revertedWithCustomError(contributionRegistry, "AccessControlUnauthorizedAccount");

            // Verify the role was not revoked
            expect(await contributionRegistry.hasRole(await contributionRegistry.CONTRIBUTOR_ROLE(), nonContributor.address)).to.equal(true);
        });

        it("Should allow transferring DEFAULT_ADMIN_ROLE", async () => {
            const {admin, third} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();

            await contributionRegistry.connect(admin).grantRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), third.address);
            await contributionRegistry.connect(admin).renounceRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), admin.address);

            // Verify the new admin has the role and the original deployer does not
            expect(await contributionRegistry.hasRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), third.address)).to.be.true;
            expect(await contributionRegistry.hasRole(await contributionRegistry.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.false;
        });

        // TODO: _MANAGER roles
    });

    describe("Pausing functionality", () => {
        it("Should restrict pausing functionality to accounts with PAUSER_ROLE", async function () {
            const {expertContributor, third} = await getSigners();
            const {contributionRegistry} = await deployContributionRegistryFixture();


            const actions = [
                contributionRegistry.connect(third).pause(),
                contributionRegistry.connect(expertContributor).pause(),
            ];

            for (const action of actions) {
                await expect(action).revertedWithCustomError(contributionRegistry, "AccessControlUnauthorizedAccount");
            }
        });
    });

    describe("Contributions", function () {
        describe("Submission", function () {
            it("Should allow an expert contributor to contribute, and emit a 'Contribution' event", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/dataset";

                const tx = await contract.connect(expertContributor).contribute(third.address, uri);
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
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/dataset";
                const expectedTokenId = 1;

                const tx = await contract.connect(contributor).contribute(contributor.address, uri);
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
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // First, remove the "contributor" role, just in case
                await contract.connect(deployer).revokeRole(await contract.CONTRIBUTOR_ROLE(), expertContributor.address);
                expect(await contract.hasRole(await contract.CONTRIBUTOR_ROLE(), expertContributor.address)).to.be.false;

                const uri = "https://example.com/dataset";

                const attemptContribute = contract.connect(expertContributor).contribute(expertContributor.address, uri);
                await expect(attemptContribute).to.not.be.reverted;
            });

            it("Should assign ownership and URI correctly to a contributor", async () => {
                const {contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/dataset";
                await contract.connect(contributor).contribute(contributor.address, uri);

                const expectedTokenId = 1;

                expect(await contract.ownerOf(expectedTokenId)).to.equal(contributor.address);
                expect(await contract.metadata(expectedTokenId)).to.equal(uri);
            });

            it("Should assign ownership and URI correctly by an expert contributor", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/dataset";
                await contract.connect(expertContributor).contribute(third.address, uri);

                const expectedTokenId = 1;

                expect(await contract.ownerOf(expectedTokenId)).to.equal(third.address);
                expect(await contract.metadata(expectedTokenId)).to.equal(uri);
            });

            it("Should not allow a regular contributor to contribute for others", async () => {
                const {third, contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                await expect(
                    contract.connect(contributor).contribute(third.address, "https://example.com/illicit-dataset")
                ).to.be.revertedWithCustomError(
                    contract, "CannotContributeForOthers"
                );
            });

            it("Should reject unauthorized dataset submission", async () => {
                const {third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                await expect(
                    contract.connect(third).contribute(third.address, "https://example.com/illicit-dataset")
                ).to.be.revertedWithCustomError(
                    contract, "NotContributor"
                );

                await expect(
                    contract.connect(third).contribute(third.address, "https://example.com/illicit-dataset")
                ).to.be.revertedWithCustomError(
                    contract, "NotContributor"
                );
            });
        });

        describe("URI/metadata management", function () {
            it("Should allow a contributor to set the URI for their own contribution", async () => {
                const {contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/dataset";
                await contract.connect(contributor).contribute(contributor.address, uri);

                const datasetId = 1;
                expect(await contract.metadata(datasetId)).to.equal(uri);

                const newUri = "https://example.com/new-dataset-uri";

                await expect(contract.connect(contributor).setMetadata(datasetId, newUri))
                    .to.emit(contract, 'ContributionMetadataUpdated')
                    .withArgs(contributor.address, datasetId, newUri); // Ensure to include all args as expected in the event

                expect(await contract.metadata(datasetId)).to.equal(newUri);
            });

            it("Should not allow an expert contributor to set the URI for other's contribution", async () => {
                const {contributor, expertContributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // Submitting a dataset as a regular contributor
                const uri = "https://example.com/dataset";
                await contract.connect(contributor).contribute(contributor.address, uri);

                const datasetId = 1; // The ID of the dataset submitted by the contributor
                expect(await contract.metadata(datasetId)).to.equal(uri);

                // An expert contributor attempts to update the URI for the dataset submitted by the contributor
                const newUri = "https://example.com/updated-dataset-uri";

                const action = contract.connect(expertContributor).setMetadata(datasetId, newUri);
                await expect(action).to.revertedWithCustomError(contract, "NotAuthorizedToUpdateMetadata")

                // Verify the URI was not updated
                expect(await contract.metadata(datasetId)).to.equal(uri);
            });

            it("Should not allow a contributor to set the URI for others's contribution", async () => {
                const {contributor, expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // An expert contributor submits a dataset on behalf of a third party
                const uri = "https://example.com/dataset-for-third";
                await contract.connect(expertContributor).contribute(third.address, uri);

                const datasetId = 1; // Assuming this is the dataset ID assigned
                expect(await contract.metadata(datasetId)).to.equal(uri);

                // A different contributor attempts to update the URI for the dataset owned by 'third'
                const newUri = "https://example.com/unauthorized-update-uri";

                // Expect the attempt to fail due to insufficient permissions
                const action = contract.connect(contributor).setMetadata(datasetId, newUri);
                await expect(action).to.revertedWithCustomError(contract, "NotAuthorizedToUpdateMetadata")

                // Verify the URI was not updated
                expect(await contract.metadata(datasetId)).to.equal(uri);
            });
        });

        describe("Submission if contract is paused", () => {
            it("Should pause and prevent contribution submission/manipulation", async function () {
                const {pauser, contributor, expertContributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                await contract.connect(expertContributor).contribute(expertContributor.address, "https://example.com/contribution-1")

                // Pause the contract
                await contract.connect(pauser).pause();
                expect(await contract.paused()).to.equal(true);

                const actions = [
                    contract.connect(expertContributor).contribute(expertContributor.address, "https://example.com/contribution-2"),
                    contract.connect(expertContributor).setMetadata(1, "new-uri"),
                ];

                for (const action of actions) {
                    await expect(action).to.be.revertedWithCustomError(contract, "EnforcedPause");
                }
            });

            it("Should unpause and allow contribution", async function () {
                const {pauser, contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                await contract.connect(pauser).pause();
                expect(await contract.paused()).to.be.true;

                await contract.connect(pauser).unpause();
                expect(await contract.paused()).to.be.false;

                const action = contract.connect(contributor).contribute(contributor.address, "https://example.com/contribution");
                await expect(action).not.to.be.reverted;
            });
        });

        describe("Enumerable extension", function () {
            it("Should enumerate contributions", async () => {
                const {contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const expectedTokenIds = [1n, 2n, 3n];

                // Submit some contributions
                for (let i = 0; i < expectedTokenIds.length; i++) {
                    await contract.connect(contributor).contribute(contributor.address, `testURI#${i}`);
                }

                // Total supply
                expect(await contract.totalSupply()).to.equal(expectedTokenIds.length);

                // By owner
                for (let i = 0; i < expectedTokenIds.length; i++) {
                    const tokenId = await contract.tokenOfOwnerByIndex(contributor.address, i);
                    expect(tokenId).to.equal(expectedTokenIds[i]);
                }

                // Owner-agnostic
                for (let i = 0; i < expectedTokenIds.length; i++) {
                    const tokenId = await contract.tokenByIndex(i);
                    expect(tokenId).to.equal(expectedTokenIds[i]);
                }
            });
        });

        describe("Tracking of the original contributor", function () {
            it("Should record the submitter as the original contributor when a contribution is submitted directly", async () => {
                const {contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();
                const uri = "https://example.com/direct-submission";

                await contract.connect(contributor).contribute(contributor.address, uri);
                const contributionId = 1; // Assuming this is the contribution ID assigned

                const originalContributor = await contract.getOriginalContributor(contributionId);
                expect(originalContributor).to.equal(contributor.address);
            });

            it("Should record the submitter as the original contributor when a contribution is submitted", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/submission";

                await contract.connect(expertContributor).contribute(third.address, uri);
                const contributionId = 1; // Assuming this is the contribution ID assigned

                const originalContributor = await contract.getOriginalContributor(contributionId);
                expect(originalContributor).to.equal(expertContributor.address);
            });

            it("Should keep the original contributor unchanged after ownership transfer", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/ownership-transfer";
                await contract.connect(expertContributor).contribute(expertContributor.address, uri);

                const contributionId = 1; // Assuming this is the contribution ID assigned

                // Assuming the contract allows transferring the contribution (if applicable)
                await contract.connect(expertContributor).safeTransferFrom(expertContributor.address, third.address, contributionId);

                const originalContributor = await contract.getOriginalContributor(contributionId);
                expect(originalContributor).to.equal(expertContributor.address);
            });
        });
    });

    describe("Transfer authorization", function () {
        describe("Transfer by expert contributors", function () {
            it("Should allow an expert contributor to transfer their own", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // An expert contributor contributes data and receives an NFT
                const uri = "https://example.com/expert-contribution";
                await contract.connect(expertContributor).contribute(expertContributor.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the expert contributor
                expect(await contract.ownerOf(contributionId)).to.equal(expertContributor.address);

                // Attempt to transfer NFT from expert contributor to recipient
                await contract.connect(expertContributor).safeTransferFrom(expertContributor.address, third.address, contributionId);

                // Verify the new owner of the NFT is the recipient
                expect(await contract.ownerOf(contributionId)).to.equal(third.address);
            });

            it("Should not allow a regular contributor to transfer, even their own", async () => {
                const {contributor: regularContributor, third: recipient} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // A regular contributor contributes data and receives an NFT
                const uri = "https://example.com/regular-contributor-contribution";
                await contract.connect(regularContributor).contribute(regularContributor.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the regular contributor
                expect(await contract.ownerOf(contributionId)).to.equal(regularContributor.address);

                // Attempt to transfer NFT from regular contributor to recipient
                // Expect the attempt to fail due to restrictions on transfer by regular contributors
                const action = contract.connect(regularContributor).safeTransferFrom(regularContributor.address, recipient.address, contributionId);
                await expect(action).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed
                expect(await contract.ownerOf(contributionId)).to.equal(regularContributor.address);
            });
        });

        describe("Transfer by non-owners", function () {
            it("Should not allow third party to transfer", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // An expert contributor contributes data and receives an NFT
                const uri = "https://example.com/expert-contribution";
                await contract.connect(expertContributor).contribute(expertContributor.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the expert contributor
                expect(await contract.ownerOf(contributionId)).to.equal(expertContributor.address);

                // Attempt to transfer NFT from a non-owner third party account
                // Expect the attempt to fail due to the third party not owning the NFT
                const action = contract.connect(third).safeTransferFrom(expertContributor.address, third.address, contributionId);
                await expect(action).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed
                expect(await contract.ownerOf(contributionId)).to.equal(expertContributor.address);
            });

            it("Should not allow non-owner to transfer, even the original contributor", async () => {
                const {expertContributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // An expert contributor contributes data on behalf of a third party
                const uri = "https://example.com/expert-contribution";
                await contract.connect(expertContributor).contribute(third.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the third party
                // but the original contributor is the expertContributor
                expect(await contract.ownerOf(contributionId)).to.equal(third.address);
                expect(await contract.getOriginalContributor(contributionId)).to.equal(expertContributor.address);

                // The expert contributor, who is not the current owner, attempts to transfer the NFT back to themselves
                const action = contract.connect(expertContributor).safeTransferFrom(third.address, expertContributor.address, contributionId);

                // Expect the attempt to fail due to the expert contributor not having ownership or approval
                await expect(action).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");

                // Verify the owner of the NFT has not changed and remains with the third party
                expect(await contract.ownerOf(contributionId)).to.equal(third.address);
            });
        });

        describe("Transfer Attempt with Delegated Authority", function () {
            it("Should not allow expert contributors to delegate transfer authority", async () => {
                const {deployer, expertContributor, contributor} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // An expert contributor contributes data and receives an NFT
                const uri = "https://example.com/expert-contribution";
                await contract.connect(expertContributor).contribute(expertContributor.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the expert contributor
                expect(await contract.ownerOf(contributionId)).to.equal(expertContributor.address);

                // Delegate transfer authority to another expert contributor
                const approval = contract.connect(expertContributor).approve(contributor.address, contributionId);
                await expect(approval).to.emit(contract, "Approval")

                // Grant EXPERT_CONTRIBUTOR_ROLE to contributor
                const grantRole = contract.connect(deployer).grantExpertContributorRole(contributor.address);
                await expect(grantRole).to.emit(contract, "ExpertContributorRoleGrantedByManager");

                // Verify that contributor still cannot transfer
                const transferAction = contract.connect(contributor).safeTransferFrom(expertContributor.address, contributor.address, contributionId);
                await expect(transferAction).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");
            });

            it("Should not allow regular contributors to delegate transfer authority", async () => {
                const {deployer, contributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // A regular contributor contributes data and receives an NFT
                const uri = "https://example.com/regular-contribution";
                await contract.connect(contributor).contribute(contributor.address, uri);

                const contributionId = 1; // Assuming this is the first contribution and hence the NFT ID is 1

                // Verify the initial owner of the NFT is the regular contributor
                expect(await contract.ownerOf(contributionId)).to.equal(contributor.address);

                // Attempt to delegate transfer authority to another regular contributor
                const approval = contract.connect(contributor).approve(third.address, contributionId);
                await expect(approval).to.emit(contract, "Approval");

                // Verify that third still cannot transfer
                const transferAction = contract.connect(third).safeTransferFrom(contributor.address, third.address, contributionId);
                await expect(transferAction).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");
            });
        });

        describe("Invalid Transfer Scenarios", function () {
            it("Should fail transfer if the token ID does not exist", async () => {
                const {deployer, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                // Attempt to transfer NFT with a non-existent token ID
                const nonexistentTokenId = 999; // Assuming this token ID does not exist
                const transferAction = contract.connect(deployer).safeTransferFrom(deployer.address, third.address, nonexistentTokenId);

                // Expect the transfer to fail due to the non-existent token ID
                await expect(transferAction).to.be.revertedWithCustomError(contract, "ERC721NonexistentToken");
            });

            it("Should fail transfer if the spender is not the owner nor the original contributor", async () => {
                const {contributor, third} = await getSigners();
                const {contributionRegistry: contract} = await deployContributionRegistryFixture();

                const uri = "https://example.com/contribution";
                await contract.connect(contributor).contribute(contributor.address, uri);

                const tokenId = 1; // Assuming this is the first token ID

                // Verify the initial owner of the NFT is the owner
                expect(await contract.ownerOf(tokenId)).to.equal(contributor.address);

                // Attempt transfer by an unrelated account
                const transferAction = contract.connect(third).safeTransferFrom(contributor.address, third.address, tokenId);

                // Expect the transfer to fail due to lack of ownership or original contribution
                await expect(transferAction).to.be.revertedWithCustomError(contract, "ERC721InsufficientApproval");
            });
        });
    });
});
