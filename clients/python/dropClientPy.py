import requests

class DropsAPIClient:
    def __init__(self, base_url, auth_token):
        self.base_url = base_url
        self.headers = {'Authorization': auth_token, 'Content-Type': 'application/json'}
    
    def create_transfer(self, transfers):
        url = f"{self.base_url}/transfer"
        response = requests.post(url, json=transfers, headers=self.headers)
        return response.json()
    
    def delete_transfer(self, transfer_id):
        url = f"{self.base_url}/transfer/{transfer_id}"
        response = requests.delete(url, headers=self.headers)
        return response.json()
    
    def get_transfer(self, transfer_id):
        url = f"{self.base_url}/transfer/{transfer_id}"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def get_transfers(self, query_params=None):
        url = f"{self.base_url}/transfers"
        response = requests.get(url, headers=self.headers, params=query_params)
        return response.json()