package com.guamradar.backend;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ChatRequestValidator {
  private final ObjectMapper objectMapper;
  private final int maxMessages;
  private final int maxMessageChars;
  private final int maxTotalMessageChars;
  private final int maxContextChars;

  public ChatRequestValidator(
    ObjectMapper objectMapper,
    @Value("${CHAT_MAX_MESSAGES:12}") int maxMessages,
    @Value("${CHAT_MAX_MESSAGE_CHARS:2000}") int maxMessageChars,
    @Value("${CHAT_MAX_TOTAL_MESSAGE_CHARS:10000}") int maxTotalMessageChars,
    @Value("${CHAT_MAX_CONTEXT_CHARS:12000}") int maxContextChars
  ) {
    this.objectMapper = objectMapper;
    this.maxMessages = Math.max(1, maxMessages);
    this.maxMessageChars = Math.max(100, maxMessageChars);
    this.maxTotalMessageChars = Math.max(this.maxMessageChars, maxTotalMessageChars);
    this.maxContextChars = Math.max(1_000, maxContextChars);
  }

  public void validate(ChatRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Chat request is required.");
    }

    List<ChatMessage> messages = request.messages();
    if (messages == null || messages.isEmpty()) {
      throw new IllegalArgumentException("Add a message before asking GuamRadar.");
    }

    if (messages.size() > maxMessages) {
      throw new IllegalArgumentException("This conversation is too long. Please start a new chat.");
    }

    int totalChars = 0;
    boolean hasUserMessage = false;
    for (ChatMessage message : messages) {
      if (message == null) {
        throw new IllegalArgumentException("Chat messages cannot be empty.");
      }

      String role = normalizeRole(message.role());
      if (!role.equals("user") && !role.equals("assistant")) {
        throw new IllegalArgumentException("Unsupported chat message role.");
      }

      String content = message.content() == null ? "" : message.content().trim();
      if (content.isBlank()) {
        throw new IllegalArgumentException("Chat messages cannot be blank.");
      }

      if (content.length() > maxMessageChars) {
        throw new IllegalArgumentException("One of your messages is too long. Please shorten it.");
      }

      totalChars += content.length();
      if (totalChars > maxTotalMessageChars) {
        throw new IllegalArgumentException("This chat request is too large. Please shorten the conversation.");
      }

      if (role.equals("user")) {
        hasUserMessage = true;
      }
    }

    ChatMessage lastMessage = messages.get(messages.size() - 1);
    if (!normalizeRole(lastMessage.role()).equals("user")) {
      throw new IllegalArgumentException("The latest chat message must come from the user.");
    }

    if (!hasUserMessage) {
      throw new IllegalArgumentException("A user message is required.");
    }

    validateContextSize(request.context());
  }

  private void validateContextSize(Map<String, Object> context) {
    if (context == null || context.isEmpty()) return;
    String contextJson = objectMapper.writeValueAsString(context);
    if (contextJson.length() > maxContextChars) {
      throw new IllegalArgumentException("The app context is too large. Please try again.");
    }
  }

  private String normalizeRole(String role) {
    return role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
  }
}
