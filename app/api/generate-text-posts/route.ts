import { NextRequest, NextResponse } from 'next/server';

interface GenerateTextPostsRequest {
  apiKey: string;
  topic: string;
  platform: string;
  referenceLink?: string;
  count?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      apiKey,  
      topic, 
      platform,
      referenceLink,
      count = 5
    }: GenerateTextPostsRequest = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!topic || !platform) {
      return NextResponse.json(
        { error: 'Topic and platform are required' },
        { status: 400 }
      );
    }

    // Create the prompt for Gemini
    const prompt = createTextPostPrompt(topic, platform, referenceLink, count);
    
    // Generate text posts using Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate text posts' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json(
        { error: 'No text posts generated' },
        { status: 500 }
      );
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Parse the response to extract text posts
    const textPosts = parseGeneratedTextPosts(generatedText);
    
    return NextResponse.json({ texts: textPosts });
  } catch (error) {
    console.error('Error generating text posts:', error);
    return NextResponse.json(
      { error: 'Failed to generate text posts' },
      { status: 500 }
    );
  }
}

function createTextPostPrompt(
  topic: string,
  platform: string,
  referenceLink?: string,
  postCount: number = 5
): string {
  const linkInstruction = referenceLink 
    ? `\n- Include this reference link naturally in some posts: ${referenceLink}` 
    : '';
  
  return `Generate EXACTLY ${postCount} engaging text posts about "${topic}" for ${platform}.

Requirements:
1. Generate exactly ${postCount} unique text posts
2. Each post should be engaging, informative, and relevant to the topic
3. Match the ${platform} platform style and tone
4. Posts should be standalone text content (no images/videos)
5. Use appropriate emojis and hashtags for ${platform}
6. Vary the post styles (questions, tips, quotes, stories, facts)${linkInstruction}

Format your response as:
POST 1:
[First text post content]

POST 2:
[Second text post content]

POST 3:
[Third text post content]

${postCount > 3 ? `POST 4:\n[Fourth text post content]\n\n` : ''}${postCount > 4 ? `POST 5:\n[Fifth text post content]\n\n` : ''}${postCount > 5 ? `POST 6:\n[Sixth text post content]\n\n` : ''}${postCount > 6 ? `POST 7:\n[Seventh text post content]\n\n` : ''}${postCount > 7 ? `POST 8:\n[Eighth text post content]\n\n` : ''}${postCount > 8 ? `POST 9:\n[Ninth text post content]\n\n` : ''}${postCount > 9 ? `POST 10:\n[Tenth text post content]\n\n` : ''}

Make sure each post is unique, engaging, and appropriate for ${platform}.`;
}

function parseGeneratedTextPosts(text: string): string[] {
  const posts: string[] = [];
  
  // Split by POST markers
  const postBlocks = text.split(/POST\s+\d+:/i);
  
  // Skip the first element (before first POST marker)
  for (let i = 1; i < postBlocks.length; i++) {
    const postContent = postBlocks[i].trim();
    if (postContent) {
      // Clean up the content by removing extra whitespace and newlines
      const cleanedPost = postContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
      
      if (cleanedPost) {
        posts.push(cleanedPost);
      }
    }
  }
  
  // If no posts found with POST markers, try alternative parsing
  if (posts.length === 0) {
    const lines = text.split('\n');
    let currentPost = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        if (currentPost) {
          posts.push(currentPost.trim());
          currentPost = '';
        }
        continue;
      }
      
      // Check for numbered posts
      const numberedMatch = trimmedLine.match(/^\d+\.\s*(.+)/);
      if (numberedMatch) {
        if (currentPost) {
          posts.push(currentPost.trim());
        }
        currentPost = numberedMatch[1];
      } else if (currentPost) {
        currentPost += '\n' + trimmedLine;
      } else {
        currentPost = trimmedLine;
      }
    }
    
    if (currentPost) {
      posts.push(currentPost.trim());
    }
  }
  
  return posts.filter(post => post.length > 0);
}