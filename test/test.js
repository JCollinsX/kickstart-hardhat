const {ethers} = require('hardhat');
const hre = require('hardhat');
const chai = require('chai');
const {solidity} = require('ethereum-waffle');
const {BN} = require("@openzeppelin/test-helpers");
chai.use(solidity);
const {expect} = chai;

let signers;
let factoryAddress;
let factory;
let campaignAddress;
let campaign;

beforeEach(async () => {
    signers = await ethers.getSigners();

    const CampaignFactory = await ethers.getContractFactory("CampaignFactory", signers[0])
    factory = await CampaignFactory.deploy()
    await factory.deployed()
    factoryAddress = factory.address

    await factory.connect(signers[0]).createCampaign(ethers.utils.parseUnits('0.1', 'ether'));

    [campaignAddress] = await factory.getDeployedCampaigns()
    campaign = await ethers.getContractAt("Campaign", campaignAddress)
});

describe("Campaigns", function () {
    it("deploys a factory and a campaign", async function () {
        expect(campaignAddress).to.be.not.undefined;
        expect(campaignAddress).to.be.not.null;
        expect(factoryAddress).to.be.not.undefined;
        expect(factoryAddress).to.be.not.null;
    });

    it('marks caller as the campaign manager', async () => {
        const manager = await campaign.manager.call();
        expect(signers[0].address).equal(manager);
    });

    it('allows people to contribute money and marks them as approvers', async () => {
        await campaign.connect(signers[1]).contribute({value: ethers.utils.parseUnits('0.2', 'ether')})
        const isContributor = await campaign.approvers(signers[1].address);
        expect(isContributor).equal(true);
    });

    it('requires a minimum contribution', async () => {
        try {
            await campaign.connect(signers[1]).contribute({value: ethers.utils.parseUnits('0.05', 'ether')});
            expect(false);
        } catch (err) {
            expect(err);
        }
    });

    it('allows a manager to make a payment request', async () => {
      await campaign
          .connect(signers[0])
          .createRequest(
              'Buy batteries', ethers.utils.parseUnits('0.3', 'ether'), signers[1].address,
          );
      const request = await campaign.requests(0);

      expect('Buy batteries', request.description);
    });

    it('processes requests', async () => {
        await campaign.connect(signers[0]).contribute({
            value: ethers.utils.parseUnits('0.2', 'ether')
        })

        await campaign
            .connect(signers[0])
            .createRequest('A', ethers.utils.parseUnits('0.2', 'ether'), signers[1].address);

        await campaign.connect(signers[0]).approveRequest(0);

        await campaign.connect(signers[0]).finalizeRequest(0);

        let balance = await signers[0].getBalance();
        balance = ethers.utils.parseEther(balance.toString())
        balance = parseFloat(balance);
        expect(balance).gte(9.8);
    });
});