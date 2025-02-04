import {Router} from "express";
import agentController from "../controllers/agent.controller";

const agentRouter = Router();

agentRouter
    .route("/start")
    .post(agentController.startSession.bind(agentController));

agentRouter
    .route("/message")
    .post(agentController.sendMessage.bind(agentController));


export default agentRouter;
