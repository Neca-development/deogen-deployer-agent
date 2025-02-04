import {Router} from "express";
import agentRouter from "./agent.router";

const router: Router = Router();
router.use("/agent", agentRouter);

export default router;
