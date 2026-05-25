import pandas as pd

# load your CSV (semicolon-separated)
df = pd.read_csv("diet_clean_no_extra.csv", sep=";")

# replace empty values (NaN) with 0 in specific columns
df["Doručak (kcal)"] = df["Doručak (kcal)"].fillna(0)
df["Ručak (kcal)"] = df["Ručak (kcal)"].fillna(0)
df["Večera (kcal)"] = df["Večera (kcal)"].fillna(0)

df["Doručak"] = df["Doručak"].fillna("/")
df["Ručak"] = df["Ručak"].fillna("/")
df["Večera"] = df["Večera"].fillna("/")

# save the cleaned file
df.to_csv("diet_clean_zeros.csv", sep=";", index=False)