// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { LeftClawServicesV2 } from "../contracts/LeftClawServicesV2.sol";

contract AddWorkerScript is Script {
    function run() external {
        // SANITIZER wallet (server wallet for postJobFor)
        address sanitizer = 0xCfB32a7d01Ca2B4B538C83B2b38656D3502D76EA;

        // Read contract address from environment or use latest deployed
        address contractAddress = vm.envOr("CONTRACT_ADDRESS", 0xb3c4ecF74CB3427432ADFF277Bb5C9B8fd9b71e0);
        LeftClawServicesV2 contract_ = LeftClawServicesV2(payable(contractAddress));

        vm.startBroadcast();
        contract_.addWorker(sanitizer);
        vm.stopBroadcast();

        console.log("Added worker:", sanitizer);
        console.log("Contract:", contractAddress);
    }
}
