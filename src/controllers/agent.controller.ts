import { NextFunction, Request, Response } from 'express';
import {
    AgentKit, cdpApiActionProvider, cdpWalletActionProvider,
    CdpWalletProvider, erc20ActionProvider,
    pythActionProvider,
    walletActionProvider,
    wethActionProvider
} from "@coinbase/agentkit";
import {MemorySaver} from "@langchain/langgraph";
import {getLangChainTools} from "@coinbase/agentkit-langchain";
import {createReactAgent} from "@langchain/langgraph/prebuilt";
import fs from "node:fs";
import {ChatOpenAI} from "@langchain/openai";
import {StartSessionDto} from "../dto/start-session.dto";
import {IResponse} from "../interfaces/response.interface";
import {HumanMessage} from "@langchain/core/messages";
import {SendMessageDto} from "../dto/send-message.dto";


class AgentController {
    private static Sessions: { sessionId: string, agent: any, config: any }[] = [];
    
    public async sendMessage(request: Request, response: Response, next: NextFunction) {
        const result: IResponse = {
            data: null,
            error: null
        };
        
        try {
            const body = request.body as SendMessageDto;
            
            const session = AgentController.Sessions.find(x => x.sessionId === body.sessionId);
            
            if (session == null) {
                result.error = "Session ID not registered";
                response.status(400).send(result);
                return;
            }
            
            result.data = await this.queryAgent(session.agent, session.config, body.message);
            response.status(200).send(result);
            return;
            
        } catch (e) {
            next(e);
        }
    }
    
    public async startSession(request: Request, response: Response, next: NextFunction) {
        const result: IResponse = {
            data: null,
            error: null
        };
        
        try {
            const body = request.body as StartSessionDto;
            
            if (AgentController.Sessions.map(x => x.sessionId).includes(body.sessionId)) {
                result.error = "Session ID already exists";
                response.status(400).send(result);
                return;
            }
            
            const {agent, config} = await this.prepareAgent(body.prompt, body.sessionId);
            
            AgentController.Sessions.push({
                sessionId: body.sessionId,
                agent,
                config
            });
            
            response.status(200).send(result);
        } catch (e) {
            next(e);
        }
    }
    
    private async queryAgent(agent: any, config: any, query: string) {
        const stream = await agent.stream({
            messages: [new HumanMessage(query)]
        }, config);

        for await (const chunk of stream) {
            if ("agent" in chunk) {
                return chunk.agent.messages[0].content;
            } else if ("tools" in chunk) {
                return chunk.tools.messages[0].content;
            }
        }
    }
    
    private async prepareAgent(prompt: string, sessionId: string) {
        const walletProvider = await CdpWalletProvider.configureWithWallet({
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            networkId: process.env.NETWORK_ID,
            cdpWalletData: undefined
        });

        const agentKit = await AgentKit.from({
            walletProvider,
            actionProviders: [
                wethActionProvider(),
                pythActionProvider(),
                walletActionProvider(),
                erc20ActionProvider(),
                cdpApiActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                cdpWalletActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
            ],
        });

        const memorySaver = new MemorySaver();
        const tools = await getLangChainTools(agentKit);
        const agentConfig = { configurable: { thread_id: sessionId } };
        
        const agent = createReactAgent({
            llm: new ChatOpenAI({
                model: "gpt-4"
            }),
            tools,
            checkpointSaver: memorySaver,
            stateModifier: prompt
        });

        const exportedWallet = await walletProvider.exportWallet();
        fs.writeFileSync(`${sessionId}.json`, JSON.stringify(exportedWallet));

        return {agent, config: agentConfig};
    }
}

export default new AgentController();
