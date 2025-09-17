import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, promptType = 'image', style, environment, theme, mood, promptCount, additionalDetails } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    let systemPrompt = '';
    
    if (promptType === 'video') {
       // Build the system prompt for video generation (Veo3)
       systemPrompt = `You are an expert at creating detailed, high-quality prompts for AI video generation models like Google Veo3.

Create ${promptCount} unique and detailed video generation prompts with these general specifications:

Style: ${style}
Environment/Setting: ${environment}
Visual Theme: ${theme}
Mood/Tone: ${mood}`;

       if (additionalDetails) {
         systemPrompt += `\nAdditional Details: ${additionalDetails}`;
       }

       systemPrompt += `\n\nEach video prompt should:
1. Be detailed and specific for high-quality video generation
2. Include camera movement descriptions (pan, zoom, dolly, static shot, tracking)
3. Specify video quality and style (cinematic, documentary, artistic, commercial)
4. Include lighting and mood descriptions
5. Describe movements, actions, and scene dynamics
6. Be optimized for Veo3 video generation
7. Focus on creating engaging, creative video content
8. Include timing and pacing suggestions
9. Specify video length and frame rate when relevant
10. Can include various subjects: people, objects, nature, abstract concepts, etc.

Return ${promptCount} separate video prompts, each on a new line, without numbering or additional formatting. Each prompt should be complete and ready to use for Veo3 video generation.`;
    } else {
      // Build the system prompt for image generation
      systemPrompt = `You are an expert at creating detailed, high-quality prompts for AI image generation models like Midjourney, DALL-E, and Stable Diffusion.

Create ${promptCount} unique and detailed image generation prompts with these general specifications:

Style: ${style}
Environment/Setting: ${environment}
Visual Theme: ${theme}
Mood/Tone: ${mood}`;

      if (additionalDetails) {
        systemPrompt += `\nAdditional Details: ${additionalDetails}`;
      }

      systemPrompt += `\n\nEach prompt should:
1. Be detailed and specific for high-quality image generation
2. Include professional photography terms (lighting, composition, camera settings)
3. Specify image quality keywords (4K, ultra-detailed, photorealistic, etc.)
4. Include artistic style references when appropriate
5. Be optimized for AI image generation models
6. Focus on creating engaging, creative visual content
7. Include relevant details about composition, lighting, and atmosphere
8. Can include various subjects: people, objects, landscapes, abstract concepts, etc.

Return ${promptCount} separate prompts, each on a new line, without numbering or additional formatting. Each prompt should be complete and ready to use for image generation.`;
    }

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const promptText = response.text();
    
    // Split the response into individual prompts
    const prompts = promptText.split('\n').filter(prompt => prompt.trim().length > 0);

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error generating prompts:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompts. Please check your API key and try again.' },
      { status: 500 }
    );
  }
}