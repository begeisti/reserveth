const { config, tenderly, run } = require("hardhat");
const { utils, ethers } = require("ethers");

async function main() {
    const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const agendaContract = await hre.ethers.getContractAt("Agenda", contractAddress);
    const signer = new ethers.Wallet(process.env.MY_WALLET_PRIVATE_KEY, new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/"));

    const bookings = await agendaContract.connect(signer).getMyBookings();

    console.log(bookings);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });