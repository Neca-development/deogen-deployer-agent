import {Router} from "express";
import agentController from "../controllers/agent.controller";

const agentRouter: Router = Router();

agentRouter
    .route("start")
    .post(agentController.startSession);

agentRouter
    .route("message")
    .post(agentController.sendMessage);


export default agentRouter;
