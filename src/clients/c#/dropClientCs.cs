using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Newtonsoft.Json;

public class Transfer
{
    public string Sender { get; set; }
    public string Receiver { get; set; }
    public string Memo { get; set; }
    public string Application { get; set; }
}

public class TransfersClient
{
    private readonly HttpClient _httpClient;

    public TransfersClient(string baseUrl, string authKey)
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(baseUrl) };
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authKey);
    }

    public async Task<List<string>> PostTransferAsync(List<Transfer> transfers)
    {
        var response = await _httpClient.PostAsync("/transfer", new StringContent(JsonConvert.SerializeObject(transfers), System.Text.Encoding.UTF8, "application/json"));
        response.EnsureSuccessStatusCode();
        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<Dictionary<string, List<string>>>(responseContent)["transferIds"];
    }

    public async Task<Transfer> GetTransferByIdAsync(string transferId)
    {
        var response = await _httpClient.GetAsync($"/transfer/{transferId}");
        response.EnsureSuccessStatusCode();
        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<Transfer>(responseContent);
    }

    public async Task<List<Transfer>> GetTransfersAsync(string application = null, string receiver = null, string sender = null, string memo = null, string status = null, string sortByTime = "asc")
    {
        var query = new List<string>();
        if (!string.IsNullOrEmpty(application)) query.Add($"application={application}");
        if (!string.IsNullOrEmpty(receiver)) query.Add($"receiver={receiver}");
        if (!string.IsNullOrEmpty(sender)) query.Add($"sender={sender}");
        if (!string.IsNullOrEmpty(memo)) query.Add($"memo={memo}");
        if (!string.IsNullOrEmpty(status)) query.Add($"status={status}");
        query.Add($"sort_by_time={sortByTime}");

        var response = await _httpClient.GetAsync($"/transfers?{string.Join("&", query)}");
        response.EnsureSuccessStatusCode();
        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<List<Transfer>>(responseContent);
    }
}

// Example usage:
public class Program
{
    public static async Task Main(string[] args)
    {
        var baseUrl = "http://localhost:3000";
        var authKey = "your_auth_key";
        var client = new TransfersClient(baseUrl, authKey);

        var transfers = new List<Transfer>
        {
            new Transfer { Sender = "user1", Receiver = "user2", Memo = "Test transfer", Application = "app1" },
            new Transfer { Sender = "user3", Receiver = "user4", Memo = "Another test transfer", Application = "app2" }
        };

        try
        {
            var transferIds = await client.PostTransferAsync(transfers);
            Console.WriteLine($"Posted transfers with IDs: {string.Join(", ", transferIds)}");

            foreach (var transferId in transferIds)
            {
                var transfer = await client.GetTransferByIdAsync(transferId);
                Console.WriteLine($"Transfer {transferId}: {JsonConvert.SerializeObject(transfer)}");
            }

            var filteredTransfers = await client.GetTransfersAsync(application: "app1", sortByTime: "desc");
            Console.WriteLine($"Filtered transfers: {JsonConvert.SerializeObject(filteredTransfers)}");
        }
        catch (Exception e)
        {
            Console.WriteLine($"An error occurred: {e.Message}");
        }
    }
}
