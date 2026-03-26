// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Script, console } from "forge-std/Script.sol";
import { LeftClawServicesV2 } from "../contracts/LeftClawServicesV2.sol";

contract AddWorkerScript is Script {
    function run() external {
        // SANITIZER wallet (server wallet for postJobFor)
        address sanitizer = 0xCfB32a7d01Ca2B4B538C83B2b38656D3502D76EA;

        // New contract
        LeftClawServicesV2 contract_ = LeftClawServicesV2(payable(0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F));

        vm.startBroadcast();
        contract_.addWorker(sanitizer);
        vm.stopBroadcast();

        console.log("Added worker:", sanitizer);
    }
}
