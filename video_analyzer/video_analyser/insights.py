import openai

# The prompt as specified
PROMPT = """
You are a highly experienced padel coach and former WPT professional player, specializing in coaching players from beginners to pro level.
You will receive statistics from a padel rally, detailing the player's time spent in the volley zone, transition zone (no man's land), and defense zone.
Task
Analyze the provided stats, comparing them to the optimal positioning of professional WPT players, which typically follows:
Volley zone: 40-50%
Transition zone: 15-20%
Defense zone: 35-45%
Identify key areas for improvement in the player's court positioning.
Provide clear, concise recommendations (maximum 3 bullet points) on how the player can optimize their movement and positioning to enhance their game.
Response Format
- Use professional language with a motivational and encouraging tone.
- Format the response with bullet points, marked with emojis.
- Add relevant emojis within the text for a friendly touch (but don't overuse them).
- Keep the response brief and impactful—no more than 3 bullet points. Do not mention the WPT players stats numbers explicitly.
"""


def analyze_stats(api_key: str, volley_percentage, transition_percentage, defense_percentage) -> str:
    """
    Get padel game insights based on player's court positioning statistics

    Args:
        volley_percentage: Percentage of time spent in volley zone
        transition_percentage: Percentage of time spent in transition zone
        defense_percentage: Percentage of time spent in defense zone

    Returns:
        Analysis and recommendations from the AI coach
    """

    # Create the complete prompt with player's stats
    player_stats = f"""
        Player's Statistics:
        - Volley zone: {volley_percentage}%
        - Transition zone: {transition_percentage}%
        - Defense zone: {defense_percentage}%
    """

    full_prompt = PROMPT + "\n" + player_stats

    openai.api_key = api_key

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional padel coach providing game insights."},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.7,  # Adjust for more creative (higher) or more deterministic (lower) responses
        max_tokens=300,  # Adjust based on how long you want the response to be
        top_p=0.95,  # Controls diversity of responses
        frequency_penalty=0.0,
        presence_penalty=0.0,
    )

    # Extract and return the advice
    return response.choices[0].message.content
