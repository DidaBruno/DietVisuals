import pandas as pd

# read CSV
df = pd.read_csv("diet_clean_dates.csv", sep=";")

# delete unnamed columns 13-17
df = df.drop(columns=["Unnamed: 13", "Unnamed: 14", "Unnamed: 15",
                       "Unnamed: 16", "Unnamed: 17"])

df.to_csv(
    "diet_clean_no_extra.csv",
    sep=";",
    index=False,
    encoding="utf-8-sig"
)