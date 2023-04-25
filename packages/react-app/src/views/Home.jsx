import { useContractReader } from "eth-hooks";
import { ethers } from "ethers";
import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import Modal from "react-modal";

const modalStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    background: "#40a9ff",
  },
};

const calendarStyles = {
  container: {
    minHeight: 600,
    minWidth: 600,
    maxHeight: 1500,
    maxWidth: 1500,
  },
  calendar: {
    position: "absolute",
  },
};

/**
 * web3 props can be passed from '../App.jsx' into your local view component for use
 * @param {*} tx The transactor wraps transactions and provides notificiations
 * @param {*} localProviderPollingTime local polltimes
 * @param {*} readContracts contracts from current chain already pre-loaded using ethers contract module. More here https://docs.ethers.io/v5/api/contract/contract/
 * @param {*} writeContracts contracts from current chain already pre-loaded using ethers contract module.
 * @returns react component
 **/
function Home({ tx, localProviderPollingTime, readContracts, writeContracts }) {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState(undefined);
  // you can also use hooks locally in your component of choice
  // in this case, let's keep track of 'purpose' variable from our contract
  const timeslots = useContractReader(readContracts, "Agenda", "getAvailableTimeSlots", [], localProviderPollingTime);
  const duration = useContractReader(readContracts, "Agenda", "duration", [], localProviderPollingTime);
  const price = useContractReader(readContracts, "Agenda", "priceOfService", [], localProviderPollingTime);
  const myBookings = useContractReader(readContracts, "Agenda", "getMyBookings", [], localProviderPollingTime);
  if (myBookings) {
    console.log("My bookings", myBookings);
  }
  let events = [];
  if (timeslots && duration) {
    // Display only future timestamps
    events = timeslots
      .filter(ts => ts.toNumber() >= Date.now())
      .map(ts => ({
        title: "Booking",
        start: new Date(ts.toNumber()),
        end: new Date(ts.toNumber() + duration.toNumber()),
      }));
  }
  let durationInMinutes;
  if (duration) {
    durationInMinutes = duration.toNumber() / 60000;
  }
  let priceInEther;
  if (price) {
    priceInEther = ethers.utils.formatEther(price);
  }

  const onEventClick = eventInfo => {
    setBookingModalOpen(true);
    setSelectedTimestamp(eventInfo.event.start);
  };

  const dismissModal = () => {
    setBookingModalOpen(false);
  };

  const confirmBooking = () => {
    console.log(timeslots);
    /**
     * Need to find the nearest timestamp. After creating the Date object from the timestamps,
     * the milliseconds are cut off, therefore we cannot use those for making a booking as they would be rejected.
     */
    //
    let i = 0;
    while (Math.abs(timeslots[i].toNumber() - selectedTimestamp.getTime()) > 1000) {
      i++;
    }
    tx(writeContracts.Agenda.book(timeslots[i], { value: price }));
    dismissModal();
  };

  return (
    <div
      style={{
        margin: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      {myBookings && (
        <div id="my_bookings">
          {myBookings[0].length === 0 && <h1>You don't have bookings yet!</h1>}
          {myBookings[0].length !== 0 && <h1>{`You have ${myBookings[0].length} bookings!`}</h1>}
        </div>
      )}
      <div style={calendarStyles.container}>
        <Modal
          isOpen={bookingModalOpen}
          onRequestClose={dismissModal}
          style={modalStyles}
          contentLabel="Confirm booking"
        >
          <p>{`Do you want to make a booking at ${selectedTimestamp}?`}</p>
          <p>{`The price of the service is ${priceInEther} ether(s).`}</p>
          <p>{`The duration of the service is ${durationInMinutes} minutes.`}</p>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around" }}>
            <button onClick={confirmBooking}>Confirm</button>
            <button onClick={dismissModal}>Cancel</button>
          </div>
        </Modal>
        <div
          style={
            bookingModalOpen
              ? { ...calendarStyles.container, ...calendarStyles.calendar, zIndex: -1 }
              : { ...calendarStyles.container, ...calendarStyles.calendar }
          }
        >
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            displayEventEnd="true"
            // eventContent={renderAvailableTimeSlot}
            eventClick={onEventClick}
            eventColor="#blue"
          />
        </div>
      </div>
    </div>
  );
}

export default Home;
