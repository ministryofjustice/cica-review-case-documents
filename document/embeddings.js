'use strict';

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({region: process.env.AWS_REGION, 
    credentials:{
        secretAccessKey:process.env.SECRET_ACCESS_KEY,
        accessKeyId:process.env.ACCESS_KEY_ID
    }
});

async function createEmbeddings() {
    const prompt = `Define, in terms a young child would understand, what the meaning of life is. You should answer by using a short story as an example.`;
    
    const input = {
        modelId:"amazon.titan-embed-text-v2:0", // amazon.titan-text-lite-v1
        contentType:"application/json",
        accept:"application/json",
        body: JSON.stringify({
            inputText: prompt,
            textGenerationConfig: {
                maxTokenCount: 512
            }
        })
    };
    
    const command = new InvokeModelCommand(input);
    const resp = await client.send(command);
    const decodedResponseBody = JSON.parse(new TextDecoder().decode(resp.body));
    console.log({decodedResponseBody});
    return decodedResponseBody;
}



export default createEmbeddings;