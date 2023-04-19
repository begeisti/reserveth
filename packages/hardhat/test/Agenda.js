const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Agenda contract", () => {

  const priceOfService = ethers.utils.parseEther("1.0");
  const durationOfService = 40 * 60 * 1000; // 40 minutes in ms
  const cancellableBefore = 60 * 60 * 1000; // 60 minutes in ms

  async function deploy(firstBookableTimestamp, lastBookableTimestamp, price, duration, cancellableBefore) {
    const [owner, booker] = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("Agenda");
    const agendaContract = await contractFactory.deploy(firstBookableTimestamp, lastBookableTimestamp, price, duration, cancellableBefore);
    return { agendaContract, owner, booker };
  }

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  describe("constructor", () => {
    const firstBookableTime = Date.now();
    const lastBookableTime = firstBookableTime + 4 * 60 * 60 * 1000; // 4 hours later

    it("initializes the contract correctly", async () => {
      const { agendaContract, owner } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      const agendaOwner = await agendaContract.owner();
      const price = await agendaContract.priceOfService();
      const duration = await agendaContract.duration();
      const cancelBefore = await agendaContract.cancellableBefore();
      expect(agendaOwner).to.equal(owner.address);
      expect(price).to.equal(priceOfService);
      expect(duration).to.equal(durationOfService);
      expect(cancelBefore).to.equal(cancellableBefore);
    });

    it("shouldn't deploy with invalid time interval", async () => {
      await expect(deploy(firstBookableTime, firstBookableTime + durationOfService - 60000, priceOfService, durationOfService, cancellableBefore)).to.be.revertedWith("Invalid time interval provided!");
    });
  })

  describe("getAvailableTimeSlots()", function () {
    const firstBookableTime = Date.now();
    const lastBookableTime = firstBookableTime + 4 * 60 * 60 * 1000; // 4 hours later

    it("should return all timestamps after deploy", async () => {
      const { agendaContract } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      const expectedTimestamps = [];
      let tmp = firstBookableTime;
      while (tmp <= lastBookableTime) {
        expectedTimestamps.push(tmp);
        tmp += durationOfService;
      }
      
      const timeslots = await agendaContract.getAvailableTimeSlots();
      
      expect(expectedTimestamps.length).to.equal(timeslots.length);
      for (let i = 0; i < timeslots.length; ++i) {
        expect(timeslots[i].toNumber()).to.equal(expectedTimestamps[i]);
      }
    })

    it("should return only non-booked timestamps", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      // booking the first timestamp
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });
      const expectedTimestamps = [];
      let tmp = firstBookableTime + durationOfService;
      while (tmp <= lastBookableTime) {
        expectedTimestamps.push(tmp);
        tmp += durationOfService;
      }

      const timeslots = await agendaContract.getAvailableTimeSlots();
      
      expect(expectedTimestamps.length).to.equal(timeslots.length);
      for (let i = 0; i < timeslots.length; ++i) {
        expect(timeslots[i].toNumber()).to.equal(expectedTimestamps[i]);
      }
    })
  });
});