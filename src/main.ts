import {ChatOpenAI} from "@langchain/openai";
import * as dotenv from "dotenv";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {
    AgentKit, cdpApiActionProvider, cdpWalletActionProvider,
    CdpWalletProvider, erc20ActionProvider,
    pythActionProvider,
    walletActionProvider,
    wethActionProvider
} from "@coinbase/agentkit";
import {getLangChainTools} from "@coinbase/agentkit-langchain";
import {MemorySaver} from "@langchain/langgraph";
import {createReactAgent} from "@langchain/langgraph/prebuilt";
import * as fs from "node:fs";

dotenv.config()

const model = new ChatOpenAI({
    model: "gpt-4"
});

async function prepareAgent() {
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
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };
    
    const agentPrompt = `You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
        funds from the user. Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.` + `
        You are an AI agent participating in a structured communication system. Your responses must always follow the XML format below.

### Incoming Message Format:
\`\`\`xml
<?xml version="1.0" encoding="utf-8"?>
<message>
    <from>[human | agent_manager | agent_designer | agent_developer]</from>
    <message>[Content]</message>
</message>
\`\`\`

### Response Format:
\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<message>
    <type>[question | statement]</type> <!-- Specify if it is a question or a statement -->
    <recipient>[agent_manager | agent_designer | agent_developer | human]</recipient> <!-- Define the recipient -->
    <content>
        <text>[Your message content]</text>
    </content>
    <payload format="json">
        {
            "code": "[Insert code snippet here]",
            "description": "[Brief explanation of the code]"
        }
    </payload>
</message>
\`\`\`

### Instructions:
- Always respond in the above XML structure.
- The \`<type>\` field should be either "question" (if you are requesting information) or "statement" (if you are providing information).
- The \`<recipient>\` field should specify the intended recipient (another AI agent or "human").
- The \`<content>\` field must contain a natural language message.
- The \`<payload>\` field must be in JSON format and should hold structured data like code snippets if needed.
- Expect incoming messages in the \`<message>\` format with a \`<from>\` field indicating the sender.
- You are allowed to ask questions to other AI agents if you need assistance. Format your questions using the defined XML structure, specifying the recipient and clearly stating what information or help you require.

⚠️ Do not deviate from this format. Any additional information must be encapsulated within the defined XML structure.  
`;
    
    const agent = createReactAgent({
        llm: model,
        tools,
        checkpointSaver: memorySaver,
        stateModifier: agentPrompt
    });
    
    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync("wallet.json", JSON.stringify(exportedWallet));

    return {agent, config: agentConfig};
}

async function queryAgent(agent: any, config: any, query: string) {
    const stream = await agent.stream({
        messages: [new HumanMessage(query)]
    }, config);
    
    for await (const chunk of stream) {
        if ("agent" in chunk) {
            console.log("Agent say: ", chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
            console.log("Tool ready: ", chunk.tools.messages[0].content);
        }
    }
}

async function main(){
    const {agent, config} = await prepareAgent();
    console.log(config);
    await queryAgent(agent, config, `<?xml version="1.0" encoding="utf-8"?>
<message>
    <from>human</from>
    <message>Hello what you can do?</message>
</message>`);
    await queryAgent(agent, config, `<?xml version="1.0" encoding="utf-8"?>
<message>
    <from>human</from>
    <message>If i give you code for erc20 smart contract, can you deploy it?</message>
</message>`);
    await queryAgent(agent, config, `<?xml version="1.0" encoding="utf-8"?>
<message>
    <from>agent_manager</from>
    <message>Can you get me example for erc20 smart contract constructor?</message>
</message>`);
    await queryAgent(agent, config, `<?xml version="1.0" encoding="utf-8"?>
<message>
    <from>agent_manager</from>
    <message>Client want erc20 token</message>
</message>`);
}

main()
    .then(x => console.log("0"))
    .catch(err => console.log(err));
