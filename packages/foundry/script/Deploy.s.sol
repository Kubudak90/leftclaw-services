// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { DeployLeftClawServicesV2 } from "./DeployLeftClawServicesV2.s.sol";

contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployLeftClawServicesV2 deploy = new DeployLeftClawServicesV2();
        deploy.run();
    }
}
