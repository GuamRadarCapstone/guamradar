package com.guamradar.backend;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
  "CHAT_RATE_LIMIT_MAX_REQUESTS=1",
  "CHAT_RATE_LIMIT_WINDOW_SECONDS=600",
  "CHAT_MAX_REQUEST_BYTES=1024"
})
@AutoConfigureMockMvc
class ChatControllerTests {
  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private OpenAiChatService chatService;

  @BeforeEach
  void resetMocks() {
    reset(chatService);
  }

  @Test
  void chatReturnsReplyForValidRequest() throws Exception {
    when(chatService.reply(any())).thenReturn("Hafa adai! Visit Ypao Beach early for calmer water.");

    postChat("/api/chat", "203.0.113.10", validRequest("Where should I swim?"))
      .andExpect(status().isOk())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.reply").value("Hafa adai! Visit Ypao Beach early for calmer water."));

    verify(chatService, times(1)).reply(any());
  }

  @Test
  void validationErrorsReturnBadRequestBeforeCallingOpenAi() throws Exception {
    postChat("/api/chat", "203.0.113.11", """
      {"messages":[],"context":{}}
      """)
      .andExpect(status().isBadRequest())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("invalid_request"))
      .andExpect(jsonPath("$.error").value("Add a message before asking GuamRadar."));

    verifyNoInteractions(chatService);
  }

  @Test
  void streamValidationErrorsReturnJsonBadRequest() throws Exception {
    postChat("/api/chat/stream", "203.0.113.12", """
      {"messages":[{"role":"assistant","content":"Need anything else?"}],"context":{}}
      """)
      .andExpect(status().isBadRequest())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("invalid_request"))
      .andExpect(jsonPath("$.error").value("The latest chat message must come from the user."));

    verifyNoInteractions(chatService);
  }

  @Test
  void policyGuardBlocksCodeRequestsBeforeCallingOpenAi() throws Exception {
    postChat("/api/chat", "203.0.113.13", validRequest("Make me a Python script for KFC in Yigo."))
      .andExpect(status().isOk())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("can't generate code")));

    verify(chatService, never()).reply(any());
  }

  @Test
  void rateLimitReturnsTooManyRequests() throws Exception {
    when(chatService.reply(any())).thenReturn("First reply");

    postChat("/api/chat", "203.0.113.14", validRequest("Give me one Guam tip."))
      .andExpect(status().isOk());

    postChat("/api/chat", "203.0.113.14", validRequest("Give me another Guam tip."))
      .andExpect(status().isTooManyRequests())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("rate_limited"));

    verify(chatService, times(1)).reply(any());
  }

  @Test
  void requestSizeFilterRejectsOversizedChatAndStreamRequests() throws Exception {
    String oversized = validRequest("x".repeat(1_500));

    postChat("/api/chat", "203.0.113.15", oversized)
      .andExpect(status().is(413))
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("request_too_large"));

    postChat("/api/chat/stream", "203.0.113.16", oversized)
      .andExpect(status().is(413))
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("request_too_large"));

    verifyNoInteractions(chatService);
  }

  @Test
  void providerFailureReturnsBadGateway() throws Exception {
    when(chatService.reply(any())).thenThrow(new IOException("upstream failed"));

    postChat("/api/chat", "203.0.113.17", validRequest("What is good in Tumon?"))
      .andExpect(status().isBadGateway())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("chat_provider_error"));
  }

  @Test
  void configurationFailureReturnsServiceUnavailable() throws Exception {
    when(chatService.reply(any())).thenThrow(new IllegalStateException("missing key"));

    postChat("/api/chat", "203.0.113.18", validRequest("What is good in Dededo?"))
      .andExpect(status().isServiceUnavailable())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("chat_unavailable"));
  }

  @Test
  void unexpectedFailureReturnsInternalServerError() throws Exception {
    when(chatService.reply(any())).thenThrow(new RuntimeException("unexpected"));

    postChat("/api/chat", "203.0.113.19", validRequest("What is good in Hagatna?"))
      .andExpect(status().isInternalServerError())
      .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
      .andExpect(jsonPath("$.code").value("chat_error"));
  }

  private ResultActions postChat(String path, String remoteAddr, String body) throws Exception {
    return mockMvc.perform(post(path)
      .with(remoteAddr(remoteAddr))
      .contentType(MediaType.APPLICATION_JSON)
      .content(body));
  }

  private RequestPostProcessor remoteAddr(String remoteAddr) {
    return request -> {
      request.setRemoteAddr(remoteAddr);
      return request;
    };
  }

  private String validRequest(String userMessage) {
    return """
      {"messages":[{"role":"user","content":"%s"}],"context":{"source":"test"}}
      """.formatted(userMessage);
  }
}
