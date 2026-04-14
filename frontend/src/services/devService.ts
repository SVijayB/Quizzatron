import { API_BASE_URL } from "./config";

interface Developer {
  name: string;
  desc: string;
  email: string;
  linkedin: string;
  image: string;
}

export const fetchDevInfo = async (): Promise<Developer[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dev-info`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch developer information: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Developer information loaded:', data);
    return data;
  } catch (error) {
    console.error('Error fetching developer information:', error);
    return [];
  }
};
