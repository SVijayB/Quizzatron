
interface CategoryResponse {
  [key: string]: number | string;
}

export const fetchCategories = async (): Promise<string[]> => {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/categories/get');
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Check if response is empty
    if (!text) {
      console.error('Empty response from categories API');
      return [];
    }
    
    try {
      const data: CategoryResponse = JSON.parse(text);
      console.log('Categories API response:', data);
      
      // Include ALL categories, including trivia-qa ones
      return Object.keys(data);
    } catch (parseError) {
      console.error('Error parsing categories JSON:', parseError, 'Raw text:', text);
      return [];
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const fetchQuizByCategory = async (
  category: string,
  difficulty: string,
  numQuestions: number,
  includeImage: boolean
) => {
  try {
    const queryParams = new URLSearchParams({
      topic: category,
      difficulty,
      num_questions: numQuestions.toString(),
      image: includeImage.toString()
    });

    console.log(`Fetching quiz for category: ${category}, difficulty: ${difficulty}, questions: ${numQuestions}, image: ${includeImage}`);
    
    // Use the local API endpoint until the deployed one is fixed
    const response = await fetch(
      `http://127.0.0.1:5000/api/questions/get?${queryParams}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch quiz by category: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text) {
      throw new Error('Empty response');
    }
    
    // Parse the response and log for debugging
    const parsedData = JSON.parse(text);
    console.log('Quiz API response:', parsedData);
    
    // Check if the response is in the form [data, statusCode]
    if (Array.isArray(parsedData) && parsedData.length === 2 && typeof parsedData[1] === 'number') {
      return parsedData[0]; // Return just the questions array
    }
    
    return parsedData; // Return as is if not in the [data, statusCode] format
  } catch (error) {
    console.error('Error fetching quiz by category:', error);
    throw error;
  }
};
