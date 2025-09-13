export const estimateOpenAICost = (productCount) => {
  const avgTokensPerProduct = 150;
  const totalTokens = productCount * avgTokensPerProduct;
  const costPer1kTokens = 0.0006;

  return {
    inputTokens: Math.round(totalTokens * 0.7),
    outputTokens: Math.round(totalTokens * 0.3),
    estimatedCost: (totalTokens / 1000) * costPer1kTokens,
  };
};

export const batchCategorizeWithOpenAI = async (products, progressCallback) => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment."
    );
  }

  const categorizedProducts = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      const productText = [
        product.name,
        product.title,
        product.description,
        product.brand,
      ]
        .filter(Boolean)
        .join(" ");

      const prompt = `Categorize this automotive part: "${productText}"
      
      Respond with only a JSON object like this:
      {
        "category": "category name",
        "subcategory": "subcategory name", 
        "partType": "specific part type",
        "confidence": 85
      }`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 150,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      let result = {
        category: "",
        subcategory: "",
        partType: "",
        confidence: 0,
      };

      try {
        result = JSON.parse(content);
      } catch (e) {
        // Failed to parse response, use defaults
      }

      categorizedProducts.push({
        ...product,
        suggestedCategory: result.category || "",
        suggestedSubcategory: result.subcategory || "",
        suggestedPartType: result.partType || "",
        confidence: Math.min(100, Math.max(0, result.confidence || 0)),
      });

      // Update progress
      if (progressCallback) {
        progressCallback(i + 1, products.length);
      }

      // Small delay to avoid rate limits
      if (i < products.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      categorizedProducts.push({
        ...product,
        suggestedCategory: "",
        suggestedSubcategory: "",
        suggestedPartType: "",
        confidence: 0,
        error: error.message,
      });
    }
  }

  return categorizedProducts;
};
