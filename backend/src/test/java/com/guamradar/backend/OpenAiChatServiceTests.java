package com.guamradar.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class OpenAiChatServiceTests {
  private final ObjectMapper objectMapper = new ObjectMapper();
  private HttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void replyParsesTopLevelOutputTextAndSendsResponsesPayload() throws Exception {
    AtomicReference<String> capturedRequest = stubOpenAiResponse(200, "application/json", """
      {"output_text":"Visit Ypao Beach early for calmer water."}
      """);

    String reply = service().reply(request("Where should I swim?"));

    assertThat(reply).isEqualTo("Visit Ypao Beach early for calmer water.");

    JsonNode body = objectMapper.readTree(capturedRequest.get());
    assertThat(body.path("model").asText()).isEqualTo("gpt-5-mini");
    assertThat(body.path("instructions").asText()).contains("You are GuamRadar's assistant.");
    assertThat(body.path("input").asText())
      .contains("GuamRadar app context JSON")
      .contains("User: Where should I swim?");
    assertThat(body.path("max_output_tokens").asInt()).isEqualTo(400);
    assertThat(body.path("reasoning").path("effort").asText()).isEqualTo("minimal");
    assertThat(body.path("text").path("verbosity").asText()).isEqualTo("low");
  }

  @Test
  void replyParsesNestedOutputTextItems() throws Exception {
    stubOpenAiResponse(200, "application/json", """
      {
        "output": [
          {
            "content": [
              {"type": "output_text", "text": "Start with Two Lovers Point."},
              {"type": "output_text", "text": "Then head to Tumon for dinner."}
            ]
          }
        ]
      }
      """);

    String reply = service().reply(request("Plan a short Tumon stop."));

    assertThat(reply).isEqualTo("Start with Two Lovers Point.\n\nThen head to Tumon for dinner.");
  }

  @Test
  void replyUsesOpenAiErrorMessageForNonSuccessResponses() {
    stubOpenAiResponse(429, "application/json", """
      {"error":{"message":"quota exhausted"}}
      """);

    assertThatThrownBy(() -> service().reply(request("Give me one Guam tip.")))
      .isInstanceOf(IOException.class)
      .hasMessageContaining("OpenAI request failed: quota exhausted");
  }

  @Test
  void replyExplainsMissingTextOutput() {
    stubOpenAiResponse(200, "application/json", """
      {
        "id": "resp_test",
        "status": "incomplete",
        "incomplete_details": {"reason": "max_output_tokens"},
        "output": [{"type": "reasoning"}]
      }
      """);

    assertThatThrownBy(() -> service().reply(request("Give me one Guam tip.")))
      .isInstanceOf(IOException.class)
      .hasMessageContaining("OpenAI response had no text output")
      .hasMessageContaining("id=resp_test")
      .hasMessageContaining("status=incomplete")
      .hasMessageContaining("incomplete_reason=max_output_tokens")
      .hasMessageContaining("output_types=reasoning");
  }

  @Test
  void streamReplyParsesOutputTextDeltas() throws Exception {
    AtomicReference<String> capturedRequest = stubOpenAiResponse(200, "text/event-stream", """
      event: response.output_text.delta
      data: {"type":"response.output_text.delta","delta":"Hafa "}

      event: response.output_text.delta
      data: {"type":"response.output_text.delta","delta":"adai"}

      data: [DONE]

      """);
    List<String> deltas = new ArrayList<>();

    service().streamReply(request("Say hello."), deltas::add);

    assertThat(deltas).containsExactly("Hafa ", "adai");
    JsonNode body = objectMapper.readTree(capturedRequest.get());
    assertThat(body.path("stream").asBoolean()).isTrue();
  }

  @Test
  void streamReplyThrowsOnOpenAiErrorEvent() {
    stubOpenAiResponse(200, "text/event-stream", """
      event: error
      data: {"type":"error","error":{"message":"stream failed"}}

      """);

    assertThatThrownBy(() -> service().streamReply(request("Say hello."), ignored -> {}))
      .isInstanceOf(IOException.class)
      .hasMessageContaining("stream failed");
  }

  private OpenAiChatService service() {
    HttpClient client = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(2))
      .build();
    return new OpenAiChatService(
      objectMapper,
      "test-key",
      "gpt-5-mini",
      "minimal",
      "low",
      client,
      "http://127.0.0.1:" + server.getAddress().getPort() + "/v1"
    );
  }

  private ChatRequest request(String userMessage) {
    return new ChatRequest(
      List.of(new ChatMessage("user", userMessage)),
      Map.of("village", "Tumon")
    );
  }

  private AtomicReference<String> stubOpenAiResponse(int status, String contentType, String body) {
    AtomicReference<String> capturedRequest = new AtomicReference<>();
    server.createContext("/v1/responses", exchange -> {
      capturedRequest.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      respond(exchange, status, contentType, body);
    });
    server.start();
    return capturedRequest;
  }

  private void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
    byte[] responseBytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", contentType);
    exchange.sendResponseHeaders(status, responseBytes.length);
    try (OutputStream output = exchange.getResponseBody()) {
      output.write(responseBytes);
    }
  }
}
