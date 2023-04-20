const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Agenda contract", () => {

  const priceOfService = ethers.utils.parseEther("1.0");
  const durationOfService = 40 * 60 * 1000; // 40 minutes in ms
  const cancellableBefore = 60 * 60 * 1000; // 60 minutes in ms
  const firstBookableTime = Date.now();
  const lastBookableTime = firstBookableTime + 4 * 60 * 60 * 1000; // 4 hours later

  deploy = async (firstBookableTimestamp, lastBookableTimestamp, price, duration, cancellableBefore) => {
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
      await expect(deploy(firstBookableTime, firstBookableTime - 60000, priceOfService, durationOfService, cancellableBefore)).to.be.revertedWith("Invalid time interval provided!");
    });
  })

  describe("getAvailableTimeSlots()", function () {
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

    it("should return empty list in case there are no available timeslots left", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, firstBookableTime, priceOfService, durationOfService, cancellableBefore);
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });

      const timeslots = await agendaContract.getAvailableTimeSlots();
      
      expect(timeslots.length).to.equal(0);
    })
  });

  describe("book()", () => {
    it("should revert when an invalid timestamp was sent", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await expect(agendaContract.connect(booker).book(firstBookableTime + 15 * 60 * 1000, { value: priceOfService }, )).to.be.revertedWith("The selected timeslot isn't available!");
    });

    it("should revert when timestamp is already booked", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      // booking the first timestamp
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });
      
      await expect(agendaContract.book(firstBookableTime, { value: priceOfService })).to.be.revertedWith("The selected timeslot isn't available!");
    });

    it("should revert when making a booking with less eth than the price of the service", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await expect(agendaContract.connect(booker).book(firstBookableTime, { value: ethers.utils.parseEther("0.5") })).to.be.revertedWith("Should pay the value of the service in order to make a booking!");
    });

    it("receives the value of the service, saves the booking and emits Booked event", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await agendaContract.connect(booker);
      let contractBalance = await ethers.provider.getBalance(agendaContract.address);
      expect(contractBalance).to.be.equal(ethers.utils.parseEther("0.0"));
      let availableTimeslots = await agendaContract.getAvailableTimeSlots();
      expect(availableTimeslots.length).to.equal(7);
      expect(availableTimeslots[0]).to.equal(firstBookableTime);
      let bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings.length).to.equal(2);
      expect(bookersBookings[0].length).to.equal(0);
      expect(bookersBookings[1].length).to.equal(0);

      await expect(agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService })).to.emit(agendaContract, "Booked").withArgs(booker.address, firstBookableTime, priceOfService);
      contractBalance = await ethers.provider.getBalance(agendaContract.address);
      expect(contractBalance).to.be.equal(priceOfService);
      availableTimeslots = await agendaContract.getAvailableTimeSlots();
      expect(availableTimeslots.length).to.equal(6);
      expect(availableTimeslots[0]).not.equal(firstBookableTime);
      bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings[0].length).to.equal(1);
      expect(bookersBookings[1].length).to.equal(1);
      expect(bookersBookings[0][0].toNumber()).to.equal(firstBookableTime);
      expect(bookersBookings[1][0].booker).to.equal(booker.address);
      expect(bookersBookings[1][0].confirmed).to.be.false;
      expect(bookersBookings[1][0].payedAmount).to.equal(priceOfService);
    });
  });

  describe("confirmBooking()", () => {
    it("should revert in case not the owner is calling the function", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await expect(agendaContract.connect(booker).confirmBooking(firstBookableTime)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert in case timestamp isn't booked", async () => {
      const { agendaContract } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await expect(agendaContract.confirmBooking(firstBookableTime)).to.be.revertedWith("The provided time isn't booked!");
    });

    it("should revert in case the booking was already confirmed", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });
      await agendaContract.confirmBooking(firstBookableTime);
      await expect(agendaContract.confirmBooking(firstBookableTime)).to.be.revertedWith("Booking already confirmed!");
    });

    it("should confirm booking and emit BookingConfirmed event", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });
      let bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings[0].length).to.equal(1);
      expect(bookersBookings[1].length).to.equal(1);
      expect(bookersBookings[0][0].toNumber()).to.equal(firstBookableTime);
      expect(bookersBookings[1][0].booker).to.equal(booker.address);
      expect(bookersBookings[1][0].confirmed).to.be.false;
      expect(bookersBookings[1][0].payedAmount).to.equal(priceOfService);
      
      await expect(agendaContract.confirmBooking(firstBookableTime)).to.emit(agendaContract, "BookingConfirmed").withArgs(booker.address, firstBookableTime);

      bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings[0].length).to.equal(1);
      expect(bookersBookings[1].length).to.equal(1);
      expect(bookersBookings[0][0].toNumber()).to.equal(firstBookableTime);
      expect(bookersBookings[1][0].booker).to.equal(booker.address);
      expect(bookersBookings[1][0].confirmed).to.be.true;
      expect(bookersBookings[1][0].payedAmount).to.equal(priceOfService);
    });
  });

  describe("cancelBooking()", async () => {
    it("should revert if booking doesn't belong to the caller", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, firstBookableTime, priceOfService, durationOfService, cancellableBefore);
      await expect(agendaContract.connect(booker).cancelBooking(firstBookableTime)).to.be.revertedWith("Booking doesn't belong to you!");
    });

    it("should revert if cancellation time was exceeded", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, firstBookableTime, priceOfService, durationOfService, cancellableBefore);
      await agendaContract.connect(booker).book(firstBookableTime, { value: priceOfService });
      await expect(agendaContract.connect(booker).cancelBooking(firstBookableTime)).to.be.revertedWith("Too late to cancel this booking!");
    });

    it("should delete booking, refund booker and emit BookingCancelled event", async () => {
      const { agendaContract, booker } = await deploy(firstBookableTime, lastBookableTime, priceOfService, durationOfService, cancellableBefore);
      const bookingTimestamp = firstBookableTime + 2 * durationOfService;
      const bookersInitialBalance = await ethers.provider.getBalance(booker.address);
      await agendaContract.connect(booker).book(bookingTimestamp, { value: priceOfService });
      let contractBalance = await ethers.provider.getBalance(agendaContract.address);
      expect(contractBalance).to.be.equal(priceOfService);
      const bookersBalanceAfterBooking = await ethers.provider.getBalance(booker.address);
      expect(bookersBalanceAfterBooking).to.lessThan(bookersInitialBalance.sub(priceOfService));
      let availableTimeslots = await agendaContract.getAvailableTimeSlots();
      let availableTimeslotsAsNumbers = availableTimeslots.map(ts => ts.toNumber());
      expect(availableTimeslots.length).to.equal(6);
      expect(availableTimeslotsAsNumbers).not.contain(bookingTimestamp);
      let bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings[0][0]).to.equal(bookingTimestamp);
      expect(bookersBookings[1][0].booker).to.equal(booker.address);
      
      await expect(agendaContract.connect(booker).cancelBooking(bookingTimestamp)).to.emit(agendaContract, "BookingCancelled").withArgs(booker.address, bookingTimestamp, priceOfService);

      contractBalance = await ethers.provider.getBalance(agendaContract.address);
      expect(contractBalance).to.be.equal(ethers.utils.parseEther("0.0"));
      const bookersBalanceAfterCancelledBooking = await ethers.provider.getBalance(booker.address);
      // Cannot expect to be greater with the price of service because of the used gas
      expect(bookersBalanceAfterCancelledBooking).to.greaterThan(bookersBalanceAfterBooking);
      availableTimeslots = await agendaContract.getAvailableTimeSlots();
      availableTimeslotsAsNumbers = availableTimeslots.map(ts => ts.toNumber());
      expect(availableTimeslotsAsNumbers).to.contain(bookingTimestamp);
      expect(availableTimeslots.length).to.equal(7);
      bookersBookings = await agendaContract.connect(booker).getMyBookings();
      expect(bookersBookings[0].length).to.equal(0);
      expect(bookersBookings[1].length).to.equal(0);
      // expect timeslot is bookable again
      await expect(agendaContract.connect(booker).book(bookingTimestamp, { value: priceOfService })).to.not.be.reverted;
    });
  });
});