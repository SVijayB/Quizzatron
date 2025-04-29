
interface Developer {
  name: string;
  desc: string;
  email: string;
  linkedin: string;
  image: string;
}

export const fetchDevInfo = async (): Promise<Developer[]> => {
  try {
    const response = await fetch('http://127.0.0.1:5000//api/dev-info');
    
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
